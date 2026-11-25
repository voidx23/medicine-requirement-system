import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import authRoutes from '../routes/authRoutes.js';
import { registerUser, updateUser } from '../controllers/authController.js';
import { signAuthToken } from '../config/jwtConfig.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    return app;
}

function makeQueryResult(doc) {
    const promise = Promise.resolve(doc);
    return {
        select(fields) {
            if (!doc) return Promise.resolve(null);
            if (fields === '-password') {
                const { password, ...rest } = doc;
                return Promise.resolve({ ...rest });
            }
            return Promise.resolve(doc);
        },
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
    };
}

function createMockRes() {
    const res = {
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
    return res;
}

describe('C1 Security Fix — Auth Privilege Escalation & Super Admin Takeover', () => {
    let app;
    let userRecords;
    let branchRecords;
    let nextId;

    const superAdminId = '64f000000000000000000001';
    const otherSuperAdminId = '64f000000000000000000002';
    const storeStaffId = '64f000000000000000000003';
    const targetUserId = '64f000000000000000000004';
    const branchId = '64f000000000000000000005';

    const makeUserDoc = (data) => {
        const doc = {
            ...data,
            async matchPassword(candidate) {
                return candidate === doc.password;
            },
            async save() {
                const idx = userRecords.findIndex((u) => u._id === doc._id);
                if (idx >= 0) {
                    userRecords[idx] = doc;
                }
                return doc;
            },
        };
        return doc;
    };

    const makeBranchDoc = (data) => {
        const doc = {
            ...data,
            async matchPassword(candidate) {
                return candidate === doc.password;
            },
        };
        return doc;
    };

    beforeEach(() => {
        app = createTestApp();
        nextId = 10;

        userRecords = [
            makeUserDoc({
                _id: superAdminId,
                username: 'super_admin',
                password: 'SuperSecretPassword!1',
                role: 'admin',
                isSuperAdmin: true,
                permissions: [],
                location: 'HQ',
                contactNumber: '24000001',
            }),
            makeUserDoc({
                _id: otherSuperAdminId,
                username: 'other_super_admin',
                password: 'OtherSuperPassword!2',
                role: 'admin',
                isSuperAdmin: true,
                permissions: [],
                location: 'HQ-2',
                contactNumber: '24000002',
            }),
            makeUserDoc({
                _id: storeStaffId,
                username: 'store_staff',
                password: 'StaffPassword!3',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['manage_store_staff_permissions', 'view_requirements'],
                location: 'Central Store',
                contactNumber: '24000003',
            }),
            makeUserDoc({
                _id: targetUserId,
                username: 'regular_staff',
                password: 'RegularPassword!4',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['view_tasks'],
                location: 'Warehouse A',
                contactNumber: '24000004',
            }),
        ];

        branchRecords = [
            makeBranchDoc({
                _id: branchId,
                name: 'ruwi_branch',
                password: 'BranchPassword!5',
                location: 'Ruwi',
                contactNumber: '24000005',
            }),
        ];

        vi.spyOn(User, 'findById').mockImplementation((id) => {
            const match = userRecords.find((u) => u._id === String(id)) || null;
            return makeQueryResult(match);
        });

        vi.spyOn(User, 'findOne').mockImplementation((query = {}) => {
            const match =
                userRecords.find((u) => (query.username !== undefined ? u.username === query.username : true)) || null;
            return makeQueryResult(match);
        });

        vi.spyOn(User, 'create').mockImplementation(async (payload) => {
            const created = makeUserDoc({
                _id: `64f0000000000000000000${nextId++}`,
                role: 'admin',
                isSuperAdmin: false,
                permissions: [],
                ...payload,
            });
            userRecords.push(created);
            return created;
        });

        vi.spyOn(Branch, 'findById').mockImplementation((id) => {
            const match = branchRecords.find((b) => b._id === String(id)) || null;
            return makeQueryResult(match);
        });

        vi.spyOn(Branch, 'findOne').mockImplementation((query = {}) => {
            let match = null;
            if (query?.name?.$regex) {
                match = branchRecords.find((b) => query.name.$regex.test(b.name)) || null;
            }
            return makeQueryResult(match);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('blocks non-SuperAdmin Store Staff from registering admin accounts via POST /api/auth/register', async () => {
        const staffToken = signAuthToken({ id: storeStaffId });
        const initialCount = userRecords.length;

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
                username: 'rogue_admin',
                password: 'RoguePassword123!',
                role: 'admin',
            });

        expect(res.status).toBe(401);
        expect(userRecords).toHaveLength(initialCount);
        expect(userRecords.find((u) => u.username === 'rogue_admin')).toBeUndefined();
    });

    it('blocks non-SuperAdmin Store Staff from changing a Super Admin password or another user via PUT /api/auth/users/:id', async () => {
        const staffToken = signAuthToken({ id: storeStaffId });

        const superAdminRes = await request(app)
            .put(`/api/auth/users/${superAdminId}`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ password: 'HijackedPassword!9', username: 'hijacked_super' });

        expect(superAdminRes.status).toBe(401);
        const superAdminDoc = userRecords.find((u) => u._id === superAdminId);
        expect(superAdminDoc.password).toBe('SuperSecretPassword!1');
        expect(superAdminDoc.username).toBe('super_admin');

        const staffTargetRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ password: 'ChangedStaff!9' });

        expect(staffTargetRes.status).toBe(401);
        expect(userRecords.find((u) => u._id === targetUserId).password).toBe('RegularPassword!4');
    });

    it('enforces controller-level defensive SuperAdmin guards even if called without route middleware', async () => {
        const nonSuperReqUser = { _id: storeStaffId, role: 'admin', isSuperAdmin: false };
        const initialCount = userRecords.length;

        const regRes = createMockRes();
        await registerUser(
            { user: nonSuperReqUser, body: { username: 'bypass_admin', password: 'Password123!' } },
            regRes
        );
        expect(regRes.statusCode).toBe(403);
        expect(userRecords).toHaveLength(initialCount);

        const updRes = createMockRes();
        await updateUser(
            {
                user: nonSuperReqUser,
                params: { id: superAdminId },
                body: { password: 'HijackedPassword!9' },
            },
            updRes
        );
        expect(updRes.statusCode).toBe(403);
        expect(userRecords.find((u) => u._id === superAdminId).password).toBe('SuperSecretPassword!1');
    });

    it('rejects Branch users and unauthenticated requests on register and updateUser without modifying DB', async () => {
        const branchToken = signAuthToken({ id: branchId, role: 'branch' });
        const initialCount = userRecords.length;

        const branchReg = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${branchToken}`)
            .send({ username: 'branch_created_admin', password: 'Password123!' });
        expect(branchReg.status).toBe(401);

        const branchUpd = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${branchToken}`)
            .send({ password: 'BranchHijacked!1' });
        expect(branchUpd.status).toBe(401);

        const unauthReg = await request(app)
            .post('/api/auth/register')
            .send({ username: 'anon_admin', password: 'Password123!' });
        expect(unauthReg.status).toBe(401);

        const unauthUpd = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .send({ password: 'AnonHijacked!1' });
        expect(unauthUpd.status).toBe(401);

        expect(userRecords).toHaveLength(initialCount);
        expect(userRecords.find((u) => u._id === targetUserId).password).toBe('RegularPassword!4');
    });

    it('allows Super Admin to register a regular admin and blocks request-body privilege injection', async () => {
        const superToken = signAuthToken({ id: superAdminId });

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${superToken}`)
            .send({
                username: '  new_store_admin  ',
                password: 'StrongAdminPass!1',
                role: 'superadmin',
                isSuperAdmin: true,
                permissions: ['manage_store_staff_permissions', 'view_purchasing'],
                location: 'Branch Annex',
                contactNumber: '24000099',
            });

        expect(res.status).toBe(201);
        expect(res.body.username).toBe('new_store_admin');
        expect(res.body.role).toBe('admin');
        expect(res.body.isSuperAdmin).toBe(false);
        expect(res.body.permissions).toEqual([]);
        expect(typeof res.body.token).toBe('string');

        const createdDoc = userRecords.find((u) => u.username === 'new_store_admin');
        expect(createdDoc).toBeDefined();
        expect(createdDoc.role).toBe('admin');
        expect(createdDoc.isSuperAdmin).toBe(false);
        expect(createdDoc.permissions).toEqual([]);
    });

    it('validates required inputs and duplicates safely in registerUser', async () => {
        const superToken = signAuthToken({ id: superAdminId });
        const initialCount = userRecords.length;

        const missingPassword = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${superToken}`)
            .send({ username: 'incomplete_admin', password: '   ' });

        expect(missingPassword.status).toBe(400);
        expect(userRecords).toHaveLength(initialCount);

        const duplicateUser = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${superToken}`)
            .send({ username: 'store_staff', password: 'Password123!' });

        expect(duplicateUser.status).toBe(400);
        expect(userRecords).toHaveLength(initialCount);
    });

    it('allows Super Admin to update ordinary users and self while ignoring injected privileged fields', async () => {
        const superToken = signAuthToken({ id: superAdminId });

        // Update ordinary user while trying to inject isSuperAdmin/permissions/role
        const userRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({
                username: 'regular_staff_updated',
                location: 'Warehouse B',
                contactNumber: '24999999',
                password: 'UpdatedPassword!4',
                role: 'branch',
                isSuperAdmin: true,
                permissions: ['manage_store_staff_permissions', 'delete_order_history'],
            });

        expect(userRes.status).toBe(200);
        expect(userRes.body.username).toBe('regular_staff_updated');
        expect(userRes.body.location).toBe('Warehouse B');
        expect(userRes.body.contactNumber).toBe('24999999');
        expect(userRes.body.role).toBe('admin');
        expect(userRes.body.isSuperAdmin).toBe(false);
        expect(userRes.body.permissions).toEqual(['view_tasks']);

        const updatedTarget = userRecords.find((u) => u._id === targetUserId);
        expect(updatedTarget.password).toBe('UpdatedPassword!4');
        expect(updatedTarget.isSuperAdmin).toBe(false);

        // Preserve Super Admin self-management while ignoring privilege/role injection
        const selfRes = await request(app)
            .put(`/api/auth/users/${superAdminId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({
                location: 'Main HQ Updated',
                isSuperAdmin: false,
                role: 'branch',
                permissions: ['tampered'],
            });

        expect(selfRes.status).toBe(200);
        expect(selfRes.body.location).toBe('Main HQ Updated');
        expect(selfRes.body.isSuperAdmin).toBe(true);
        expect(selfRes.body.role).toBe('admin');
        expect(selfRes.body.permissions).toEqual([]);
    });

    it('prevents a Super Admin from modifying another Super Admin account', async () => {
        const superToken = signAuthToken({ id: superAdminId });

        const res = await request(app)
            .put(`/api/auth/users/${otherSuperAdminId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ password: 'AttemptOverwrite!9', location: 'Tampered HQ' });

        expect(res.status).toBe(403);
        const otherSuper = userRecords.find((u) => u._id === otherSuperAdminId);
        expect(otherSuper.password).toBe('OtherSuperPassword!2');
        expect(otherSuper.location).toBe('HQ-2');
    });

    it('keeps Super Admin, Store Staff, and Branch login flows functional', async () => {
        const superLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: 'super_admin', password: 'SuperSecretPassword!1' });
        expect(superLogin.status).toBe(200);
        expect(superLogin.body.isSuperAdmin).toBe(true);
        expect(superLogin.body.role).toBe('admin');
        expect(typeof superLogin.body.token).toBe('string');

        const staffLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: 'store_staff', password: 'StaffPassword!3' });
        expect(staffLogin.status).toBe(200);
        expect(staffLogin.body.isSuperAdmin).toBe(false);
        expect(staffLogin.body.role).toBe('admin');
        expect(staffLogin.body.permissions).toEqual(['manage_store_staff_permissions', 'view_requirements']);

        const branchLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: 'ruwi_branch', password: 'BranchPassword!5' });
        expect(branchLogin.status).toBe(200);
        expect(branchLogin.body.role).toBe('branch');
        expect(branchLogin.body.isSuperAdmin).toBe(false);
    });

    it('rejects empty and whitespace-only passwords in updateUser without modifying stored password', async () => {
        const superToken = signAuthToken({ id: superAdminId });

        const whitespaceRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ password: '   \t\n ', location: 'Should Not Persist' });

        expect(whitespaceRes.status).toBe(400);
        expect(whitespaceRes.body.message).toMatch(/empty or whitespace-only/i);

        const emptyRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ password: '' });

        expect(emptyRes.status).toBe(400);
        expect(emptyRes.body.message).toMatch(/empty or whitespace-only/i);

        const targetDoc = userRecords.find((u) => u._id === targetUserId);
        expect(targetDoc.password).toBe('RegularPassword!4');
        expect(targetDoc.location).toBe('Warehouse A');
    });

    it('returns 404, 400 (CastError, duplicate 11000, ValidationError), and safe 500 in updateUser', async () => {
        const superToken = signAuthToken({ id: superAdminId });

        // 1. User not found (404)
        const notFoundRes = await request(app)
            .put('/api/auth/users/64f000000000000000000099')
            .set('Authorization', `Bearer ${superToken}`)
            .send({ location: 'Nowhere' });
        expect(notFoundRes.status).toBe(404);
        expect(notFoundRes.body.message).toBe('User not found');

        // 2. Invalid user ID / CastError (400)
        const origFindById = User.findById.getMockImplementation();
        vi.spyOn(User, 'findById').mockImplementation((id) => {
            if (String(id) === 'bad-object-id') {
                const err = new Error('Cast to ObjectId failed');
                err.name = 'CastError';
                return Promise.reject(err);
            }
            return origFindById(id);
        });

        const castErrRes = await request(app)
            .put('/api/auth/users/bad-object-id')
            .set('Authorization', `Bearer ${superToken}`)
            .send({ location: 'Invalid' });
        expect(castErrRes.status).toBe(400);
        expect(castErrRes.body.message).toBe('Invalid user ID');

        // 3. Duplicate username / code 11000 (400)
        const targetDoc = userRecords.find((u) => u._id === targetUserId);
        targetDoc.save = async () => {
            const dupErr = new Error('E11000 duplicate key error collection');
            dupErr.code = 11000;
            throw dupErr;
        };
        const dupRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ username: 'store_staff' });
        expect(dupRes.status).toBe(400);
        expect(dupRes.body.message).toBe('Username already exists');

        // 4. Mongoose ValidationError (400)
        targetDoc.save = async () => {
            const valErr = new Error('User validation failed: username is invalid');
            valErr.name = 'ValidationError';
            throw valErr;
        };
        const valRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ username: 'invalid_user' });
        expect(valRes.status).toBe(400);
        expect(valRes.body.message).toMatch(/validation failed/i);

        // 5. Unexpected DB error (500 without leaking internal error details)
        targetDoc.save = async () => {
            throw new Error('SENSITIVE_INTERNAL_DB_ERROR_DETAILS');
        };
        const dbErrRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ location: 'Warehouse C' });
        expect(dbErrRes.status).toBe(500);
        expect(dbErrRes.body).toEqual({ message: 'Server Error' });
        expect(JSON.stringify(dbErrRes.body)).not.toContain('SENSITIVE_INTERNAL_DB_ERROR_DETAILS');
    });

    it('accepts login with the new password and rejects the old password after updateUser', async () => {
        const superToken = signAuthToken({ id: superAdminId });

        const updRes = await request(app)
            .put(`/api/auth/users/${targetUserId}`)
            .set('Authorization', `Bearer ${superToken}`)
            .send({ password: 'BrandNewPassword!7' });

        expect(updRes.status).toBe(200);

        const newLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'regular_staff', password: 'BrandNewPassword!7' });
        expect(newLoginRes.status).toBe(200);
        expect(newLoginRes.body.username).toBe('regular_staff');
        expect(typeof newLoginRes.body.token).toBe('string');

        const oldLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'regular_staff', password: 'RegularPassword!4' });
        expect(oldLoginRes.status).toBe(401);
    });
});
