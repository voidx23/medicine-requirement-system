import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import requestRoutes from '../routes/requestRoutes.js';
import staffRoutes from '../routes/staffRoutes.js';
import { submitRequest } from '../controllers/requestController.js';
import {
    getJwtSecret,
    signAuthToken,
    signStaffVerificationToken,
    STAFF_VERIFICATION_PURPOSE,
} from '../config/jwtConfig.js';
import Branch from '../models/Branch.js';
import Staff from '../models/Staff.js';
import User from '../models/User.js';
import PharmacistRequest from '../models/PharmacistRequest.js';
import UsedVerificationToken from '../models/UsedVerificationToken.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/requests', requestRoutes);
    app.use('/api/staff', staffRoutes);
    return app;
}

function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

describe('H2-3 Security Fix — Authenticated Staff Verification & Single-Use Request Submission', () => {
    let app;
    let branchA;
    let branchB;
    let staffActive;
    let staffInactive;
    let staffOtherBranch;
    let storeStaffUser;
    let superAdminUser;

    beforeEach(async () => {
        app = createTestApp();
        await UsedVerificationToken.init();

        branchA = await Branch.create({
            name: 'Ruwi Pharmacy Branch A',
            password: 'BranchPassword!123',
        });
        branchB = await Branch.create({
            name: 'Seeb Pharmacy Branch B',
            password: 'BranchPassword!456',
        });

        staffActive = await Staff.create({
            name: 'Dr. Amina Al Balushi',
            pin: '1234',
            branches: [branchA._id],
            isActive: true,
        });
        staffInactive = await Staff.create({
            name: 'Inactive Pharmacist',
            pin: '5678',
            branches: [branchA._id],
            isActive: false,
        });
        staffOtherBranch = await Staff.create({
            name: 'Dr. Khalid Al Harthy',
            pin: '9012',
            branches: [branchB._id],
            isActive: true,
        });

        storeStaffUser = await User.create({
            username: 'store_operator',
            password: 'StorePassword!123',
            role: 'admin',
            isSuperAdmin: false,
            permissions: ['view_requests', 'forward_requests', 'manage_staff'],
        });
        superAdminUser = await User.create({
            username: 'root_superadmin',
            password: 'AdminPassword!123',
            role: 'admin',
            isSuperAdmin: true,
            permissions: [],
        });
    });

    it('rejects unauthenticated requests (401) and non-branch roles at both route and controller levels (403)', async () => {
        const medId = new mongoose.Types.ObjectId().toString();
        const verificationToken = signStaffVerificationToken({
            branchId: branchA._id,
            staffId: staffActive._id,
            staffName: staffActive.name,
        });
        const body = {
            items: [{ _id: medId, name: 'Amoxicillin 500mg', quantity: 2 }],
            verificationToken,
        };

        const unauthRes = await request(app).post('/api/requests/submit').send(body);
        expect(unauthRes.status).toBe(401);

        for (const adminUser of [storeStaffUser, superAdminUser]) {
            const token = signAuthToken({ id: adminUser._id, role: 'admin' });
            const res = await request(app)
                .post('/api/requests/submit')
                .set('Authorization', `Bearer ${token}`)
                .send(body);
            expect(res.status).toBe(403);
        }

        const unknownRoleToken = jwt.sign(
            { id: storeStaffUser._id.toString(), role: 'auditor' },
            getJwtSecret(),
            { expiresIn: '10m' }
        );
        const unknownRouteRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${unknownRoleToken}`)
            .send(body);
        expect(unknownRouteRes.status).toBe(403);

        for (const fakeRole of ['admin', 'store_staff', 'super_admin', 'guest']) {
            const mockRes = createMockRes();
            await submitRequest(
                { user: { _id: storeStaffUser._id, role: fakeRole }, body },
                mockRes
            );
            expect(mockRes.statusCode).toBe(403);
        }

        const unauthMockRes = createMockRes();
        await submitRequest({ body }, unauthMockRes);
        expect(unauthMockRes.statusCode).toBe(401);

        expect(await PharmacistRequest.countDocuments()).toBe(0);
    });

    it('rejects raw spoofing payloads without a verificationToken and stores zero requests', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({
                items: [{ _id: medId, name: 'Paracetamol 500mg', quantity: 5 }],
                submittedBy: 'Dr. Fake Spoofer',
            });

        expect(res.status).toBe(401);
        expect(await PharmacistRequest.countDocuments()).toBe(0);
    });

    it('rejects tampered, malformed, expired, auth-shaped, wrong-audience, and missing-jti tokens', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();
        const items = [{ _id: medId, name: 'Ibuprofen 400mg', quantity: 3 }];

        const validToken = signStaffVerificationToken({
            branchId: branchA._id,
            staffId: staffActive._id,
            staffName: staffActive.name,
        });
        const tamperedToken = `${validToken.slice(0, -4)}zzzz`;

        const expiredToken = jwt.sign(
            {
                branchId: branchA._id.toString(),
                staffId: staffActive._id.toString(),
                staffName: staffActive.name,
                purpose: STAFF_VERIFICATION_PURPOSE,
            },
            getJwtSecret(),
            { algorithm: 'HS256', expiresIn: '-10s', audience: STAFF_VERIFICATION_PURPOSE, jwtid: 'exp-jti-1' }
        );

        const wrongPurposeToken = jwt.sign(
            {
                branchId: branchA._id.toString(),
                staffId: staffActive._id.toString(),
                staffName: staffActive.name,
                purpose: 'other_purpose',
            },
            getJwtSecret(),
            { algorithm: 'HS256', expiresIn: '5m', audience: 'other_purpose', jwtid: 'wp-jti-1' }
        );

        const missingJtiToken = jwt.sign(
            {
                branchId: branchA._id.toString(),
                staffId: staffActive._id.toString(),
                staffName: staffActive.name,
                purpose: STAFF_VERIFICATION_PURPOSE,
            },
            getJwtSecret(),
            { algorithm: 'HS256', expiresIn: '5m', audience: STAFF_VERIFICATION_PURPOSE }
        );

        const authShapedWithVerificationAud = jwt.sign(
            {
                id: branchA._id.toString(),
                role: 'branch',
                branchId: branchA._id.toString(),
                staffId: staffActive._id.toString(),
                staffName: staffActive.name,
                purpose: STAFF_VERIFICATION_PURPOSE,
            },
            getJwtSecret(),
            { algorithm: 'HS256', expiresIn: '5m', audience: STAFF_VERIFICATION_PURPOSE, jwtid: 'auth-shape-1' }
        );

        for (const badToken of [
            'not-a-jwt',
            tamperedToken,
            expiredToken,
            branchAToken,
            wrongPurposeToken,
            missingJtiToken,
            authShapedWithVerificationAud,
        ]) {
            const res = await request(app)
                .post('/api/requests/submit')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ items, verificationToken: badToken });

            expect(res.status).toBe(401);
        }

        // Also confirm a verificationToken cannot be used as an Authorization Bearer login token
        const asAuthRes = await request(app)
            .get('/api/requests/stats')
            .set('Authorization', `Bearer ${validToken}`);
        expect(asAuthRes.status).toBe(401);
        expect(await PharmacistRequest.countDocuments()).toBe(0);
    });

    it('rejects cross-branch token reuse (403) without consuming the rightful branch token', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const branchBToken = signAuthToken({ id: branchB._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();
        const items = [{ _id: medId, name: 'Azithromycin 250mg', quantity: 4 }];

        const verifyRes = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });
        expect(verifyRes.status).toBe(200);

        const crossBranchRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchBToken}`)
            .send({ items, verificationToken: verifyRes.body.verificationToken });
        expect(crossBranchRes.status).toBe(403);
        expect(await UsedVerificationToken.countDocuments()).toBe(0);

        const rightfulRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ items, verificationToken: verifyRes.body.verificationToken });
        expect(rightfulRes.status).toBe(201);
    });

    it('rejects inactive staff and unassigned staff after token issuance without consuming token', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();
        const items = [{ _id: medId, name: 'Cetirizine 10mg', quantity: 10 }];

        const inactiveStaffToken = signStaffVerificationToken({
            branchId: branchA._id,
            staffId: staffInactive._id,
            staffName: staffInactive.name,
        });
        const inactiveRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ items, verificationToken: inactiveStaffToken });
        expect(inactiveRes.status).toBe(401);

        const verifyRes = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });
        expect(verifyRes.status).toBe(200);

        // Staff is transferred away from Branch A before submitting
        await Staff.findByIdAndUpdate(staffActive._id, { branches: [branchB._id] });

        const unassignedRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ items, verificationToken: verifyRes.body.verificationToken });
        expect(unassignedRes.status).toBe(403);
        expect(await UsedVerificationToken.countDocuments()).toBe(0);
    });

    it('ignores client-supplied submittedBy and records live verified Staff identity and submittedByStaffId', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();

        const verifyRes = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });
        expect(verifyRes.status).toBe(200);

        const submitRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({
                items: [{ _id: medId, name: 'Metformin 500mg', quantity: 8, isUrgent: true }],
                submittedBy: staffOtherBranch.name,
                verificationToken: verifyRes.body.verificationToken,
            });

        expect(submitRes.status).toBe(201);
        expect(submitRes.body.submittedBy).toBe('Dr. Amina Al Balushi');
        expect(submitRes.body.submittedBy).not.toBe(staffOtherBranch.name);
        expect(String(submitRes.body.submittedByStaffId)).toBe(String(staffActive._id));
        expect(String(submitRes.body.pharmacistId)).toBe(String(branchA._id));

        const savedDoc = await PharmacistRequest.findById(submitRes.body._id);
        expect(savedDoc.submittedBy).toBe('Dr. Amina Al Balushi');
        expect(String(savedDoc.submittedByStaffId)).toBe(String(staffActive._id));
    });

    it('rejects sequential verificationToken replay with 409 and allows fresh re-verification', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();
        const items = [{ _id: medId, name: 'Omeprazole 20mg', quantity: 6 }];

        const firstVerify = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });

        const firstSubmit = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ items, verificationToken: firstVerify.body.verificationToken });
        expect(firstSubmit.status).toBe(201);

        const replaySubmit = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ items, verificationToken: firstVerify.body.verificationToken });
        expect(replaySubmit.status).toBe(409);

        expect(await PharmacistRequest.countDocuments()).toBe(1);

        const secondVerify = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });
        const secondSubmit = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ items, verificationToken: secondVerify.body.verificationToken });
        expect(secondSubmit.status).toBe(201);
        expect(await PharmacistRequest.countDocuments()).toBe(2);
    });

    it('permits exactly one 201 winner and returns 409 for simultaneous concurrent replay', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();
        const items = [{ _id: medId, name: 'Atorvastatin 20mg', quantity: 12 }];

        const verifyRes = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });

        const [res1, res2] = await Promise.all([
            request(app)
                .post('/api/requests/submit')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ items, verificationToken: verifyRes.body.verificationToken }),
            request(app)
                .post('/api/requests/submit')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ items, verificationToken: verifyRes.body.verificationToken }),
        ]);

        const statuses = [res1.status, res2.status].sort((a, b) => a - b);
        expect(statuses).toEqual([201, 409]);
        expect(await PharmacistRequest.countDocuments()).toBe(1);
        expect(await UsedVerificationToken.countDocuments()).toBe(1);
    });

    it('configures unique jti and TTL index (expireAfterSeconds: 0) on UsedVerificationToken', async () => {
        const indexes = await UsedVerificationToken.collection.indexes();
        const jtiIndex = indexes.find((idx) => idx.key?.jti === 1);
        const ttlIndex = indexes.find((idx) => idx.key?.expiresAt === 1);

        expect(jtiIndex).toBeDefined();
        expect(jtiIndex.unique).toBe(true);
        expect(ttlIndex).toBeDefined();
        expect(ttlIndex.expireAfterSeconds).toBe(0);
    });

    it('validates items before consuming the verificationToken, supports custom items, and sanitizes 500 errors', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const verifyRes = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });

        for (const badItems of [
            [],
            null,
            [{ _id: new mongoose.Types.ObjectId().toString(), name: '   ', quantity: 1 }],
            [{ _id: new mongoose.Types.ObjectId().toString(), name: 'Valid Name', quantity: 0 }],
            [{ _id: new mongoose.Types.ObjectId().toString(), name: 'Valid Name', quantity: 1.5 }],
            [{ _id: 'bad-object-id', name: 'Valid Name', quantity: 2 }],
        ]) {
            const badRes = await request(app)
                .post('/api/requests/submit')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ items: badItems, verificationToken: verifyRes.body.verificationToken });
            expect(badRes.status).toBe(400);
        }

        // Token was not consumed by invalid payloads, so custom item submission succeeds
        const customRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({
                items: [{ _id: 'custom-170000000', name: 'Special Compound Cream', quantity: 2, isCustom: true }],
                verificationToken: verifyRes.body.verificationToken,
            });
        expect(customRes.status).toBe(201);
        expect(customRes.body.items[0].medicineId).toBeNull();
        expect(customRes.body.items[0].isCustom).toBe(true);

        // Sanitized 500 error check
        const freshToken = signStaffVerificationToken({
            branchId: branchA._id,
            staffId: staffActive._id,
            staffName: staffActive.name,
        });
        const spy = vi.spyOn(PharmacistRequest, 'create').mockRejectedValueOnce(new Error('sensitive internal db error'));
        const errRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({
                items: [{ _id: 'custom-2', name: 'Test Med', quantity: 1, isCustom: true }],
                verificationToken: freshToken,
            });
        spy.mockRestore();

        expect(errRes.status).toBe(500);
        expect(errRes.body).toEqual({ message: 'Server Error' });
    });

    it('rejects isolated wrong-purpose, wrong-audience, and unsupported JWT algorithms (HS384, HS512, none)', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();
        const items = [{ _id: medId, name: 'Amoxicillin 500mg', quantity: 2 }];

        const validAudWrongPurpose = jwt.sign(
            {
                branchId: branchA._id.toString(),
                staffId: staffActive._id.toString(),
                staffName: staffActive.name,
                purpose: 'tampered_purpose',
            },
            getJwtSecret(),
            { algorithm: 'HS256', expiresIn: '5m', audience: STAFF_VERIFICATION_PURPOSE, jwtid: 'iso-aud-1' }
        );

        const wrongAudValidPurpose = jwt.sign(
            {
                branchId: branchA._id.toString(),
                staffId: staffActive._id.toString(),
                staffName: staffActive.name,
                purpose: STAFF_VERIFICATION_PURPOSE,
            },
            getJwtSecret(),
            { algorithm: 'HS256', expiresIn: '5m', audience: 'wrong_audience', jwtid: 'iso-pur-1' }
        );

        const algTokens = ['HS384', 'HS512', 'none'].map((alg) =>
            jwt.sign(
                {
                    branchId: branchA._id.toString(),
                    staffId: staffActive._id.toString(),
                    staffName: staffActive.name,
                    purpose: STAFF_VERIFICATION_PURPOSE,
                },
                alg === 'none' ? '' : getJwtSecret(),
                { algorithm: alg, expiresIn: '5m', audience: STAFF_VERIFICATION_PURPOSE, jwtid: `alg-${alg}` }
            )
        );

        for (const token of [validAudWrongPurpose, wrongAudValidPurpose, ...algTokens]) {
            const res = await request(app)
                .post('/api/requests/submit')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ items, verificationToken: token });
            expect(res.status).toBe(401);
        }
        expect(await UsedVerificationToken.countDocuments()).toBe(0);
        expect(await PharmacistRequest.countDocuments()).toBe(0);
    });

    it('returns sanitized 500 (never 409) when UsedVerificationToken.create fails with a non-11000 database error', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const verifyRes = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });

        const createSpy = vi.spyOn(UsedVerificationToken, 'create').mockRejectedValueOnce(new Error('Primary write timeout'));
        const res = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({
                items: [{ _id: 'custom-timeout-1', name: 'Urgent Med', quantity: 1, isCustom: true }],
                verificationToken: verifyRes.body.verificationToken,
            });
        createSpy.mockRestore();

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server Error' });
        expect(await PharmacistRequest.countDocuments()).toBe(0);
    });

    it('rejects boolean/negative quantities before token consumption, handles deleted staff (401), and uses live renamed Staff.name', async () => {
        const branchAToken = signAuthToken({ id: branchA._id, role: 'branch' });
        const medId = new mongoose.Types.ObjectId().toString();

        const verifyRes = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });

        for (const badQty of [true, false, null, '', -1, -5]) {
            const badQtyRes = await request(app)
                .post('/api/requests/submit')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({
                    items: [{ _id: medId, name: 'Valid Name', quantity: badQty }],
                    verificationToken: verifyRes.body.verificationToken,
                });
            expect(badQtyRes.status).toBe(400);
        }
        expect(await UsedVerificationToken.countDocuments()).toBe(0);

        // Rename staff in DB after token issuance -> live DB name overrides token claim
        await Staff.findByIdAndUpdate(staffActive._id, { name: 'Dr. Amina Updated Name' });
        const validSubmit = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({
                items: [{ _id: medId, name: 'Valid Name', quantity: 3 }],
                verificationToken: verifyRes.body.verificationToken,
            });
        expect(validSubmit.status).toBe(201);
        expect(validSubmit.body.submittedBy).toBe('Dr. Amina Updated Name');

        // Delete staff after issuing a second token -> rejected 401 before consuming token
        const secondVerify = await request(app)
            .post('/api/staff/verify')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({ staffId: staffActive._id.toString(), pin: '1234' });
        await Staff.findByIdAndDelete(staffActive._id);

        const deletedStaffRes = await request(app)
            .post('/api/requests/submit')
            .set('Authorization', `Bearer ${branchAToken}`)
            .send({
                items: [{ _id: medId, name: 'Valid Name', quantity: 2 }],
                verificationToken: secondVerify.body.verificationToken,
            });
        expect(deletedStaffRes.status).toBe(401);
        expect(await UsedVerificationToken.countDocuments()).toBe(1);
    });
});
