import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import staffRoutes from '../routes/staffRoutes.js';
import branchRoutes from '../routes/branchRoutes.js';
import { getStaff } from '../controllers/staffController.js';
import {
    signAuthToken,
    signStaffVerificationToken,
    verifyStaffVerificationToken,
    STAFF_VERIFICATION_EXPIRES_IN_SECONDS,
    STAFF_VERIFICATION_PURPOSE,
} from '../config/jwtConfig.js';
import { resetVerifyPinRateLimiter } from '../middleware/verifyPinRateLimiter.js';
import Staff from '../models/Staff.js';
import Branch from '../models/Branch.js';
import User from '../models/User.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/staff', staffRoutes);
    app.use('/api/branches', branchRoutes);
    return app;
}

function projectRecord(record, selectExpr, defaultHiddenFields = []) {
    if (!record) return null;
    const base = { ...record };

    if (!selectExpr) {
        for (const hidden of defaultHiddenFields) {
            delete base[hidden];
        }
        return base;
    }

    const tokens = String(selectExpr).trim().split(/\s+/).filter(Boolean);
    if (tokens.every((t) => t.startsWith('+'))) {
        for (const hidden of defaultHiddenFields) {
            if (!tokens.includes(`+${hidden}`)) {
                delete base[hidden];
            }
        }
        return base;
    }

    if (tokens.every((t) => t.startsWith('-'))) {
        for (const hidden of defaultHiddenFields) {
            delete base[hidden];
        }
        for (const token of tokens) {
            delete base[token.slice(1)];
        }
        return base;
    }

    const projected = {};
    for (const token of tokens) {
        if (token in base) {
            projected[token] = base[token];
        }
    }
    if (tokens.includes('matchPin') || typeof record.matchPin === 'function') {
        projected.matchPin = record.matchPin;
    }
    return projected;
}

function makeChainQuery({ initialResult, branchRecords = [], defaultHiddenFields = [], onSelect }) {
    let selectExpr = null;
    let populateBranchesFields = null;
    let populateDefaultBranchFields = null;
    let sortSpec = null;

    const materialize = () => {
        if (Array.isArray(initialResult)) {
            let items = [...initialResult];
            if (sortSpec?.name === 1) {
                items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
            }
            return items.map((item) => {
                const projected = projectRecord(item, selectExpr, defaultHiddenFields);
                if (populateBranchesFields && Array.isArray(projected.branches)) {
                    projected.branches = projected.branches.map((bId) => {
                        const found = branchRecords.find((br) => String(br._id) === String(bId));
                        if (!found) return { _id: bId };
                        return populateBranchesFields === 'name'
                            ? { _id: found._id, name: found.name }
                            : { _id: found._id, [populateBranchesFields]: found[populateBranchesFields] };
                    });
                }
                if (populateDefaultBranchFields && projected.defaultBranch) {
                    const found = branchRecords.find((br) => String(br._id) === String(projected.defaultBranch));
                    if (found) {
                        projected.defaultBranch = { _id: found._id, name: found.name };
                    }
                }
                return projected;
            });
        }

        if (!initialResult) return null;
        const projected = projectRecord(initialResult, selectExpr, defaultHiddenFields);
        if (populateBranchesFields && Array.isArray(projected.branches)) {
            projected.branches = projected.branches.map((bId) => {
                const found = branchRecords.find((br) => String(br._id) === String(bId));
                if (!found) return { _id: bId };
                return populateBranchesFields === 'name'
                    ? { _id: found._id, name: found.name }
                    : { _id: found._id, [populateBranchesFields]: found[populateBranchesFields] };
            });
        }
        if (populateDefaultBranchFields && projected.defaultBranch) {
            const found = branchRecords.find((br) => String(br._id) === String(projected.defaultBranch));
            if (found) {
                projected.defaultBranch = { _id: found._id, name: found.name };
            }
        }
        if (typeof initialResult.matchPin === 'function') {
            projected.matchPin = initialResult.matchPin.bind(projected);
        }
        if (typeof initialResult.save === 'function') {
            projected.save = initialResult.save;
        }
        if (typeof initialResult.toObject === 'function') {
            projected.toObject = () => {
                const out = { ...projected };
                delete out.pin;
                delete out.matchPin;
                delete out.save;
                delete out.toObject;
                return out;
            };
        }
        return projected;
    };

    const chain = {
        select(expr) {
            selectExpr = expr;
            if (onSelect) onSelect(expr);
            return chain;
        },
        sort(spec) {
            sortSpec = spec;
            return chain;
        },
        populate(path, fields) {
            if (path === 'branches') populateBranchesFields = fields;
            if (path === 'defaultBranch') populateDefaultBranchFields = fields;
            return chain;
        },
        then(resolve, reject) {
            return Promise.resolve().then(materialize).then(resolve, reject);
        },
        catch(reject) {
            return Promise.resolve().then(materialize).catch(reject);
        },
    };
    return chain;
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

describe('H1 Security Fix — Cross-Branch Staff PII, PIN Hash Exposure & Directory IDOR', () => {
    let app;
    let userRecords;
    let branchRecords;
    let staffRecords;
    let lastStaffFindByIdSelect;
    let lastMatchPinCalled;

    const superAdminId = '64f000000000000000000001';
    const unprivilegedStaffId = '64f000000000000000000002';
    const dutyManagerId = '64f000000000000000000003';
    const legacyWorkforceId = '64f000000000000000000004';
    const branchManagerId = '64f000000000000000000005';
    const pharmacistManagerId = '64f000000000000000000006';
    const requestViewerId = '64f000000000000000000007';

    const branchAId = '64f0000000000000000000a1';
    const branchBId = '64f0000000000000000000b2';

    const staffBranchAId = '64f000000000000000000101';
    const staffBranchAInactiveId = '64f000000000000000000102';
    const staffBranchBId = '64f000000000000000000201';
    const nonExistentStaffId = '64f000000000000000000999';

    const makeStaffDoc = (data) => {
        const doc = {
            ...data,
            async matchPin(candidate) {
                lastMatchPinCalled = true;
                if (typeof candidate !== 'string' || !candidate || typeof this.pin !== 'string' || !this.pin) {
                    return false;
                }
                return candidate === this.plainPin;
            },
            async save() {
                const idx = staffRecords.findIndex((s) => String(s._id) === String(this._id));
                if (idx >= 0) {
                    Object.assign(staffRecords[idx], this);
                }
                return this;
            },
            toObject() {
                const clone = { ...doc };
                delete clone.pin;
                delete clone.plainPin;
                delete clone.matchPin;
                delete clone.save;
                delete clone.toObject;
                return clone;
            },
        };
        return doc;
    };

    beforeEach(() => {
        app = createTestApp();
        resetVerifyPinRateLimiter();
        lastStaffFindByIdSelect = null;
        lastMatchPinCalled = false;

        userRecords = [
            {
                _id: superAdminId,
                username: 'super_admin',
                role: 'admin',
                isSuperAdmin: true,
                permissions: [],
            },
            {
                _id: unprivilegedStaffId,
                username: 'basic_store_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['view_tasks'],
            },
            {
                _id: dutyManagerId,
                username: 'duty_scheduler_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['view_duty_schedules'],
            },
            {
                _id: legacyWorkforceId,
                username: 'legacy_workforce_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['workforce'],
            },
            {
                _id: branchManagerId,
                username: 'branch_manager_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['view_branches', 'assign_pharmacists_to_branches'],
            },
            {
                _id: pharmacistManagerId,
                username: 'hr_pharmacist_manager',
                role: 'admin',
                isSuperAdmin: false,
                permissions: [
                    'view_pharmacists',
                    'create_pharmacist_accounts',
                    'edit_pharmacist_accounts',
                ],
            },
            {
                _id: requestViewerId,
                username: 'requests_viewer_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['view_requests'],
            },
        ];

        branchRecords = [
            {
                _id: branchAId,
                name: 'Ruwi Main',
                password: '$2a$10$hashedBranchAPassword',
                location: 'Ruwi High Street',
                contactNumber: '24000010',
            },
            {
                _id: branchBId,
                name: 'Seeb Branch',
                password: '$2a$10$hashedBranchBPassword',
                location: 'Al Seeb Souq',
                contactNumber: '24000020',
            },
        ];

        staffRecords = [
            makeStaffDoc({
                _id: staffBranchAId,
                name: 'Dr. Amina Al Balushi',
                pin: '$2a$10$bcryptHashForBranchAActive',
                plainPin: '1234',
                branches: [branchAId],
                isActive: true,
                status: 'Active',
                designation: 'Senior Pharmacist',
                rating: 4.9,
                profilePicture: 'data:image/jpeg;base64,abc',
                licenseNumber: 'MOH-LIC-1001',
                licenseExpiry: '2028-01-01',
                passportNumber: 'OM-PASS-9901',
                passportExpiry: '2029-05-01',
                idCardNumber: '12345678',
                idCardExpiry: '2027-08-01',
                employeeId: 'EMP-101',
                joiningDate: '2022-01-15',
                employmentType: 'Full Time',
                remarks: 'Excellent inventory discipline',
                defaultBranch: branchAId,
                defaultShiftType: 'morning',
                defaultFromTime: '08:00',
                defaultToTime: '17:00',
                defaultOffDay: 'Friday',
                performanceIssues: [{ issueType: 'Audit', severity: 'Low', description: 'Late log once' }],
            }),
            makeStaffDoc({
                _id: staffBranchAInactiveId,
                name: 'Dr.Tariq Resigned',
                pin: '$2a$10$bcryptHashForBranchAInactive',
                plainPin: '4321',
                branches: [branchAId],
                isActive: false,
                status: 'Resigned',
                designation: 'Pharmacist',
                passportNumber: 'OM-PASS-8888',
                idCardNumber: '87654321',
                licenseNumber: 'MOH-LIC-1002',
                defaultBranch: branchAId,
                performanceIssues: [],
            }),
            makeStaffDoc({
                _id: staffBranchBId,
                name: 'Dr. Khalid Al Lawati',
                pin: '$2a$10$bcryptHashForBranchBActive',
                plainPin: '9876',
                branches: [branchBId],
                isActive: true,
                status: 'Active',
                designation: 'Chief Pharmacist',
                passportNumber: 'OM-PASS-7777',
                idCardNumber: '11223344',
                licenseNumber: 'MOH-LIC-2001',
                employeeId: 'EMP-201',
                remarks: 'Confidential HR note',
                defaultBranch: branchBId,
                performanceIssues: [{ issueType: 'HR', severity: 'Medium', description: 'Confidential warning' }],
            }),
        ];

        vi.spyOn(User, 'findById').mockImplementation((id) => {
            const match = userRecords.find((u) => String(u._id) === String(id)) || null;
            return makeChainQuery({ initialResult: match, defaultHiddenFields: ['password'] });
        });

        vi.spyOn(Branch, 'findById').mockImplementation((id) => {
            const match = branchRecords.find((b) => String(b._id) === String(id)) || null;
            return makeChainQuery({ initialResult: match, defaultHiddenFields: ['password'] });
        });

        vi.spyOn(Branch, 'find').mockImplementation(() => {
            return makeChainQuery({
                initialResult: branchRecords,
                defaultHiddenFields: [],
            });
        });

        vi.spyOn(Staff, 'find').mockImplementation((query = {}) => {
            const matched = staffRecords.filter((s) => {
                if (query.isActive !== undefined && Boolean(s.isActive) !== Boolean(query.isActive)) {
                    return false;
                }
                if (query.branches !== undefined) {
                    const assigned = Array.isArray(s.branches) ? s.branches.map(String) : [];
                    if (!assigned.includes(String(query.branches))) {
                        return false;
                    }
                }
                return true;
            });

            return makeChainQuery({
                initialResult: matched,
                branchRecords,
                defaultHiddenFields: ['pin'],
            });
        });

        vi.spyOn(Staff, 'findById').mockImplementation((id) => {
            const match = staffRecords.find((s) => String(s._id) === String(id)) || null;
            return makeChainQuery({
                initialResult: match,
                branchRecords,
                defaultHiddenFields: ['pin'],
                onSelect: (expr) => {
                    lastStaffFindByIdSelect = expr;
                },
            });
        });

        vi.spyOn(Staff, 'create').mockImplementation(async (payload) => {
            const created = makeStaffDoc({
                _id: '64f000000000000000000301',
                ...payload,
                pin: `$2a$10$hashed_${payload.pin}`,
                plainPin: payload.pin,
            });
            staffRecords.push(created);
            return created;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Staff Mongoose Schema PIN Hardening', () => {
        it('sets select: false on pin and strips pin from toJSON, toObject, and JSON.stringify', () => {
            expect(Staff.schema.path('pin').options.select).toBe(false);

            const realDoc = new Staff({
                name: 'Dr. Real Schema Test',
                pin: '$2a$10$exampleBcryptHashValue123456',
                isActive: true,
            });

            expect(realDoc.pin).toBe('$2a$10$exampleBcryptHashValue123456');
            expect(realDoc.toJSON()).not.toHaveProperty('pin');
            expect(realDoc.toObject()).not.toHaveProperty('pin');
            expect(JSON.parse(JSON.stringify(realDoc))).not.toHaveProperty('pin');
        });
    });

    describe('GET /api/staff Access Control, Projections & Injection Guards', () => {
        it('returns only own active staff with minimal safe fields for branch callers (no pin, no HR PII, no branches)', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const res = await request(app)
                .get('/api/staff')
                .set('Authorization', `Bearer ${branchAToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]._id).toBe(staffBranchAId);
            expect(res.body[0].name).toBe('Dr. Amina Al Balushi');
            expect(res.body[0].designation).toBe('Senior Pharmacist');
            expect(res.body[0].isActive).toBe(true);

            // Sensitive fields and cross-branch metadata must not appear
            expect(res.body[0]).not.toHaveProperty('pin');
            expect(res.body[0]).not.toHaveProperty('passportNumber');
            expect(res.body[0]).not.toHaveProperty('idCardNumber');
            expect(res.body[0]).not.toHaveProperty('licenseNumber');
            expect(res.body[0]).not.toHaveProperty('performanceIssues');
            expect(res.body[0]).not.toHaveProperty('remarks');
            expect(res.body[0]).not.toHaveProperty('branches');
        });

        it('allows a branch caller to explicitly request its own branchId but rejects another branchId with 403', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const ownRes = await request(app)
                .get(`/api/staff?branchId=${branchAId}`)
                .set('Authorization', `Bearer ${branchAToken}`);
            expect(ownRes.status).toBe(200);
            expect(ownRes.body).toHaveLength(1);

            const otherRes = await request(app)
                .get(`/api/staff?branchId=${branchBId}`)
                .set('Authorization', `Bearer ${branchAToken}`);
            expect(otherRes.status).toBe(403);
            expect(otherRes.body.message).toMatch(/another branch/i);
        });

        it('ignores all=true for branch users and never returns inactive or cross-branch staff', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const res = await request(app)
                .get('/api/staff?all=true')
                .set('Authorization', `Bearer ${branchAToken}`);

            expect(res.status).toBe(200);
            expect(res.body.map((s) => s._id)).toEqual([staffBranchAId]);
            expect(res.body.some((s) => s._id === staffBranchAInactiveId)).toBe(false);
            expect(res.body.some((s) => s._id === staffBranchBId)).toBe(false);
        });

        it('rejects invalid and non-string branchId values safely with 400', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });
            const superAdminToken = signAuthToken({ id: superAdminId, role: 'admin' });

            const branchInvalidRes = await request(app)
                .get('/api/staff?branchId=not-an-objectid')
                .set('Authorization', `Bearer ${branchAToken}`);
            expect(branchInvalidRes.status).toBe(400);

            const branchArrayRes = await request(app)
                .get(`/api/staff?branchId=${branchAId}&branchId=${branchBId}`)
                .set('Authorization', `Bearer ${branchAToken}`);
            expect(branchArrayRes.status).toBe(400);

            const adminInvalidRes = await request(app)
                .get('/api/staff?branchId=invalid-id')
                .set('Authorization', `Bearer ${superAdminToken}`);
            expect(adminInvalidRes.status).toBe(400);

            const adminArrayRes = await request(app)
                .get(`/api/staff?branchId=${branchAId}&branchId=${branchBId}`)
                .set('Authorization', `Bearer ${superAdminToken}`);
            expect(adminArrayRes.status).toBe(400);

            // Direct controller test with parsed NoSQL operator object
            for (const user of [
                { _id: branchAId, role: 'branch', isSuperAdmin: false, permissions: [] },
                { _id: superAdminId, role: 'admin', isSuperAdmin: true, permissions: [] },
            ]) {
                const mockRes = createMockRes();
                await getStaff({ user, query: { branchId: { $ne: '' } } }, mockRes);
                expect(mockRes.statusCode).toBe(400);
            }
        });

        it('denies unprivileged Store Staff (role: admin without staff permissions) and unauthorized roles with 403', async () => {
            const unprivilegedToken = signAuthToken({ id: unprivilegedStaffId, role: 'admin' });

            const res = await request(app)
                .get('/api/staff')
                .set('Authorization', `Bearer ${unprivilegedToken}`);

            expect(res.status).toBe(403);

            // Direct controller check for unknown role
            const req = { user: { _id: '64f000000000000000000099', role: 'guest', permissions: [] }, query: {} };
            const mockRes = createMockRes();
            await getStaff(req, mockRes);
            expect(mockRes.statusCode).toBe(403);
        });

        it('allows view_duty_schedules / legacy workforce / view_branches holders without exposing HR PII or pin', async () => {
            for (const userId of [dutyManagerId, legacyWorkforceId, branchManagerId]) {
                const token = signAuthToken({ id: userId, role: 'admin' });
                const res = await request(app)
                    .get('/api/staff')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.length).toBe(2); // Active staff across branches
                for (const staff of res.body) {
                    expect(staff).toHaveProperty('name');
                    expect(staff).toHaveProperty('branches');
                    expect(staff).not.toHaveProperty('pin');
                    expect(staff).not.toHaveProperty('passportNumber');
                    expect(staff).not.toHaveProperty('idCardNumber');
                    expect(staff).not.toHaveProperty('licenseNumber');
                    expect(staff).not.toHaveProperty('performanceIssues');
                    expect(staff).not.toHaveProperty('remarks');
                    expect(staff).not.toHaveProperty('employeeId');
                }
            }
        });

        it('allows view_pharmacists and Super Admin full HR view (including ?all=true and ?branchId) without pin', async () => {
            for (const userId of [pharmacistManagerId, superAdminId]) {
                const token = signAuthToken({ id: userId, role: 'admin' });

                const allRes = await request(app)
                    .get('/api/staff?all=true')
                    .set('Authorization', `Bearer ${token}`);

                expect(allRes.status).toBe(200);
                expect(allRes.body).toHaveLength(3);
                for (const staff of allRes.body) {
                    expect(staff).not.toHaveProperty('pin');
                }
                const branchAStaff = allRes.body.find((s) => s._id === staffBranchAId);
                expect(branchAStaff.passportNumber).toBe('OM-PASS-9901');
                expect(branchAStaff.idCardNumber).toBe('12345678');
                expect(branchAStaff.licenseNumber).toBe('MOH-LIC-1001');

                const filteredRes = await request(app)
                    .get(`/api/staff?branchId=${branchBId}`)
                    .set('Authorization', `Bearer ${token}`);
                expect(filteredRes.status).toBe(200);
                expect(filteredRes.body).toHaveLength(1);
                expect(filteredRes.body[0]._id).toBe(staffBranchBId);
                expect(filteredRes.body[0]).not.toHaveProperty('pin');
            }
        });
    });

    describe('Staff Write & Branch-Assignment Endpoints Never Leak PIN Hashes', () => {
        it('POST /api/staff, PUT /api/staff/:id, PUT /api/staff/:id/branch, and DELETE /api/staff/:id/branch/:branchId exclude pin', async () => {
            const hrToken = signAuthToken({ id: pharmacistManagerId, role: 'admin' });
            const assignToken = signAuthToken({ id: branchManagerId, role: 'admin' });

            const createRes = await request(app)
                .post('/api/staff')
                .set('Authorization', `Bearer ${hrToken}`)
                .send({ name: 'Dr. New Pharmacist', pin: '5678', designation: 'Pharmacist' });
            expect(createRes.status).toBe(201);
            expect(createRes.body.name).toBe('Dr. New Pharmacist');
            expect(createRes.body).not.toHaveProperty('pin');

            const updateRes = await request(app)
                .put(`/api/staff/${staffBranchAId}`)
                .set('Authorization', `Bearer ${hrToken}`)
                .send({ name: 'Dr. Amina Updated', pin: '9999' });
            expect(updateRes.status).toBe(200);
            expect(updateRes.body.name).toBe('Dr. Amina Updated');
            expect(updateRes.body).not.toHaveProperty('pin');

            const assignRes = await request(app)
                .put(`/api/staff/${staffBranchAId}/branch`)
                .set('Authorization', `Bearer ${assignToken}`)
                .send({ branchId: branchBId });
            expect(assignRes.status).toBe(200);
            expect(assignRes.body).not.toHaveProperty('pin');
            expect(assignRes.body).not.toHaveProperty('passportNumber');
            expect(assignRes.body.branches.some((b) => b.name === 'Seeb Branch')).toBe(true);

            const removeRes = await request(app)
                .delete(`/api/staff/${staffBranchAId}/branch/${branchBId}`)
                .set('Authorization', `Bearer ${assignToken}`);
            expect(removeRes.status).toBe(200);
            expect(removeRes.body).not.toHaveProperty('pin');
            expect(removeRes.body).not.toHaveProperty('passportNumber');
            expect(removeRes.body.branches.some((b) => String(b._id) === branchBId)).toBe(false);
        });
    });

    describe('POST /api/staff/verify Branch Ownership, Active Check & Input Validation', () => {
        it('selects +pin internally and verifies an active staff member assigned to the branch without leaking pin', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const res = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ staffId: staffBranchAId, pin: '1234' });

            expect(lastStaffFindByIdSelect).toBe('+pin');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                verified: true,
                staffId: staffBranchAId,
                name: 'Dr. Amina Al Balushi',
                verificationToken: expect.any(String),
                expiresInSeconds: STAFF_VERIFICATION_EXPIRES_IN_SECONDS,
            });
            expect(res.body).not.toHaveProperty('pin');

            const decoded = verifyStaffVerificationToken(res.body.verificationToken);
            expect(decoded.branchId).toBe(branchAId);
            expect(decoded.staffId).toBe(staffBranchAId);
            expect(decoded.staffName).toBe('Dr. Amina Al Balushi');
            expect(decoded.purpose).toBe(STAFF_VERIFICATION_PURPOSE);
            expect(decoded.aud).toBe(STAFF_VERIFICATION_PURPOSE);
            expect(typeof decoded.jti).toBe('string');
            expect(decoded.jti.length).toBeGreaterThan(0);
            expect(decoded).not.toHaveProperty('id');
            expect(decoded).not.toHaveProperty('role');
        });

        it('allows authorized admin verification without issuing a branch submission token', async () => {
            const dutyManagerToken = signAuthToken({ id: dutyManagerId, role: 'admin' });

            const res = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${dutyManagerToken}`)
                .send({ staffId: staffBranchAId, pin: '1234' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                verified: true,
                staffId: staffBranchAId,
                name: 'Dr. Amina Al Balushi',
            });
            expect(res.body).not.toHaveProperty('verificationToken');
            expect(res.body).not.toHaveProperty('expiresInSeconds');
        });

        it('rejects cross-branch PIN verification before checking the PIN', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const res = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ staffId: staffBranchBId, pin: '9876' });

            expect(res.status).toBe(403);
            expect(lastMatchPinCalled).toBe(false);
        });

        it('rejects inactive staff PIN verification and missing staff with generic 401 Invalid PIN', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const inactiveRes = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ staffId: staffBranchAInactiveId, pin: '4321' });
            expect(inactiveRes.status).toBe(401);
            expect(inactiveRes.body.message).toBe('Invalid PIN');
            expect(lastMatchPinCalled).toBe(false);

            const missingRes = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ staffId: nonExistentStaffId, pin: '1234' });
            expect(missingRes.status).toBe(401);
            expect(missingRes.body.message).toBe('Invalid PIN');
        });

        it('rejects wrong PIN with 401 and invalid staffId or empty/non-string PIN with 400', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });
            const unprivilegedToken = signAuthToken({ id: unprivilegedStaffId, role: 'admin' });

            const wrongPinRes = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ staffId: staffBranchAId, pin: '0000' });
            expect(wrongPinRes.status).toBe(401);
            expect(wrongPinRes.body.message).toBe('Invalid PIN');

            for (const badBody of [
                { staffId: 'bad-id', pin: '1234' },
                { staffId: staffBranchAId, pin: '' },
                { staffId: staffBranchAId, pin: '   ' },
                { staffId: staffBranchAId, pin: { $ne: '' } },
            ]) {
                const invalidRes = await request(app)
                    .post('/api/staff/verify')
                    .set('Authorization', `Bearer ${branchAToken}`)
                    .send(badBody);
                expect(invalidRes.status).toBe(400);
            }

            const unprivilegedRes = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${unprivilegedToken}`)
                .send({ staffId: staffBranchAId, pin: '1234' });
            expect(unprivilegedRes.status).toBe(403);
        });

        it('rejects verification-purpose JWTs in protect middleware without querying User or Branch', async () => {
            const verificationToken = signStaffVerificationToken({
                branchId: branchAId,
                staffId: staffBranchAId,
                staffName: 'Dr. Amina Al Balushi',
            });
            const branchFindSpy = vi.spyOn(Branch, 'findById');
            const userFindSpy = vi.spyOn(User, 'findById');

            const res = await request(app)
                .get('/api/staff')
                .set('Authorization', `Bearer ${verificationToken}`);

            expect(res.status).toBe(401);
            expect(branchFindSpy).not.toHaveBeenCalled();
            expect(userFindSpy).not.toHaveBeenCalled();
        });

        it('rate-limits repeated POST /api/staff/verify attempts per caller and staffId with 429', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            for (let i = 0; i < 15; i += 1) {
                const attemptRes = await request(app)
                    .post('/api/staff/verify')
                    .set('Authorization', `Bearer ${branchAToken}`)
                    .send({ staffId: staffBranchAId, pin: '0000' });
                expect(attemptRes.status).toBe(401);
            }

            const blockedRes = await request(app)
                .post('/api/staff/verify')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ staffId: staffBranchAId, pin: '1234' });

            expect(blockedRes.status).toBe(429);
            expect(blockedRes.headers['retry-after']).toBeDefined();
            expect(blockedRes.body.message).toMatch(/too many pin verification attempts/i);
        });
    });

    describe('Branch Directory Access Control (GET /api/staff/branches, /api/branches, /api/branches/:id)', () => {
        it('restricts GET /api/staff/branches to view_branches or Super Admin with minimal _id/name projection', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });
            const unprivilegedToken = signAuthToken({ id: unprivilegedStaffId, role: 'admin' });
            const branchManagerToken = signAuthToken({ id: branchManagerId, role: 'admin' });
            const superAdminToken = signAuthToken({ id: superAdminId, role: 'admin' });

            expect((await request(app).get('/api/staff/branches').set('Authorization', `Bearer ${branchAToken}`)).status).toBe(403);
            expect((await request(app).get('/api/staff/branches').set('Authorization', `Bearer ${unprivilegedToken}`)).status).toBe(403);

            for (const token of [branchManagerToken, superAdminToken]) {
                const res = await request(app)
                    .get('/api/staff/branches')
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toBe(200);
                expect(res.body).toHaveLength(2);
                expect(Object.keys(res.body[0]).sort()).toEqual(['_id', 'name']);
                expect(res.body[0]).not.toHaveProperty('password');
                expect(res.body[0]).not.toHaveProperty('contactNumber');
            }
        });

        it('restricts GET /api/branches by role & permission and minimizes fields when view_branches is absent', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });
            const unprivilegedToken = signAuthToken({ id: unprivilegedStaffId, role: 'admin' });
            const requestViewerToken = signAuthToken({ id: requestViewerId, role: 'admin' });
            const legacyWorkforceToken = signAuthToken({ id: legacyWorkforceId, role: 'admin' });
            const branchManagerToken = signAuthToken({ id: branchManagerId, role: 'admin' });
            const superAdminToken = signAuthToken({ id: superAdminId, role: 'admin' });

            expect((await request(app).get('/api/branches').set('Authorization', `Bearer ${branchAToken}`)).status).toBe(403);
            expect((await request(app).get('/api/branches').set('Authorization', `Bearer ${unprivilegedToken}`)).status).toBe(403);

            for (const token of [requestViewerToken, legacyWorkforceToken]) {
                const res = await request(app).get('/api/branches').set('Authorization', `Bearer ${token}`);
                expect(res.status).toBe(200);
                expect(Object.keys(res.body[0]).sort()).toEqual(['_id', 'name']);
                expect(res.body[0]).not.toHaveProperty('password');
            }

            for (const token of [branchManagerToken, superAdminToken]) {
                const res = await request(app).get('/api/branches').set('Authorization', `Bearer ${token}`);
                expect(res.status).toBe(200);
                expect(res.body[0]).toHaveProperty('location');
                expect(res.body[0]).toHaveProperty('contactNumber');
                expect(res.body[0]).not.toHaveProperty('password');
            }
        });

        it('enforces self-branch ownership and view_branches permission on GET /api/branches/:id', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });
            const requestViewerToken = signAuthToken({ id: requestViewerId, role: 'admin' });
            const branchManagerToken = signAuthToken({ id: branchManagerId, role: 'admin' });
            const superAdminToken = signAuthToken({ id: superAdminId, role: 'admin' });

            const ownRes = await request(app).get(`/api/branches/${branchAId}`).set('Authorization', `Bearer ${branchAToken}`);
            expect(ownRes.status).toBe(200);
            expect(ownRes.body.name).toBe('Ruwi Main');
            expect(ownRes.body).not.toHaveProperty('password');

            const crossRes = await request(app).get(`/api/branches/${branchBId}`).set('Authorization', `Bearer ${branchAToken}`);
            expect(crossRes.status).toBe(403);

            const noPermRes = await request(app).get(`/api/branches/${branchAId}`).set('Authorization', `Bearer ${requestViewerToken}`);
            expect(noPermRes.status).toBe(403);

            const badIdRes = await request(app).get('/api/branches/not-an-id').set('Authorization', `Bearer ${superAdminToken}`);
            expect(badIdRes.status).toBe(400);

            for (const token of [branchManagerToken, superAdminToken]) {
                const okRes = await request(app).get(`/api/branches/${branchBId}`).set('Authorization', `Bearer ${token}`);
                expect(okRes.status).toBe(200);
                expect(okRes.body.name).toBe('Seeb Branch');
                expect(okRes.body).not.toHaveProperty('password');
            }
        });
    });
});
