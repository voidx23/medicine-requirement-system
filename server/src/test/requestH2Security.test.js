import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import requestRoutes from '../routes/requestRoutes.js';
import { forwardItems, getStats } from '../controllers/requestController.js';
import { signAuthToken } from '../config/jwtConfig.js';
import PharmacistRequest from '../models/PharmacistRequest.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/requests', requestRoutes);
    return app;
}

function makeChainQuery(doc) {
    const chain = {
        select(expr) {
            if (!doc) return chain;
            if (expr === '-password') {
                const { password, ...rest } = doc;
                return makeChainQuery(rest);
            }
            return chain;
        },
        then(resolve, reject) {
            return Promise.resolve(doc).then(resolve, reject);
        },
        catch(reject) {
            return Promise.resolve(doc).catch(reject);
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

describe('H2 Security Fix — Cross-Branch Request Forwarding & Stats Authorization', () => {
    let app;
    let userRecords;
    let branchRecords;
    let requestRecords;
    let updateCallCount;
    let lastCountQuery;

    const superAdminId = '64f000000000000000000001';
    const unprivilegedStaffId = '64f000000000000000000002';
    const forwarderStaffId = '64f000000000000000000003';
    const legacyRequestsStaffId = '64f000000000000000000004';
    const viewRequestsStaffId = '64f000000000000000000005';

    const branchAId = '64f0000000000000000000a1';
    const branchBId = '64f0000000000000000000b2';

    const reqBranchAPartialId = '64f000000000000000000801';
    const reqBranchBPartialId = '64f000000000000000000901';
    const reqBranchAPendingId = '64f000000000000000000802';
    const reqBranchARejectedId = '64f000000000000000000803';
    const reqBranchAProcessedId = '64f000000000000000000804';
    const reqBranchAApprovedId = '64f000000000000000000805';
    const reqBranchACompletedId = '64f000000000000000000806';
    const reqBranchAUnfulfilledId = '64f000000000000000000807';
    const missingRequestId = '64f000000000000000000999';

    const itemA1PackedId = '64f000000000000000001001';
    const itemA2PendingId = '64f000000000000000001002';
    const itemA3PendingUnselectedId = '64f000000000000000001003';
    const itemA4ForwardedId = '64f000000000000000001004';

    const itemB1PackedId = '64f000000000000000002001';
    const itemB2PendingId = '64f000000000000000002002';

    const itemPend1Id = '64f000000000000000003001';
    const itemRej1Id = '64f000000000000000004001';
    const itemProc1Id = '64f000000000000000005001';
    const itemAppr1Id = '64f000000000000000006001';
    const itemComp1Id = '64f000000000000000007001';
    const itemUnful1Id = '64f000000000000000008001';
    const foreignItemId = '64f000000000000000009991';

    const cloneRequestRecord = (data) => ({
        ...data,
        items: data.items.map((item) => ({ ...item })),
    });

    beforeEach(() => {
        app = createTestApp();
        updateCallCount = 0;
        lastCountQuery = null;

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
                _id: forwarderStaffId,
                username: 'forwarder_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['forward_requests'],
            },
            {
                _id: legacyRequestsStaffId,
                username: 'legacy_requests_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['requests'],
            },
            {
                _id: viewRequestsStaffId,
                username: 'viewer_staff',
                role: 'admin',
                isSuperAdmin: false,
                permissions: ['view_requests'],
            },
        ];

        branchRecords = [
            {
                _id: branchAId,
                name: 'Ruwi Main',
                location: 'Ruwi',
                contactNumber: '24000010',
            },
            {
                _id: branchBId,
                name: 'Seeb Branch',
                location: 'Al Seeb',
                contactNumber: '24000020',
            },
        ];

        requestRecords = [
            cloneRequestRecord({
                _id: reqBranchAPartialId,
                pharmacistId: branchAId,
                submittedBy: 'Dr. Amina',
                status: 'partially_fulfilled',
                forwardingProcessed: false,
                createdAt: new Date(),
                items: [
                    { _id: itemA1PackedId, medicineId: '64f00000000000000000a001', name: 'Amoxicillin 500mg', quantity: 10, isCustom: false, isUrgent: false, status: 'packed' },
                    { _id: itemA2PendingId, medicineId: '64f00000000000000000a002', name: 'Insulin Glargine', quantity: 5, isCustom: false, isUrgent: true, status: 'pending' },
                    { _id: itemA3PendingUnselectedId, medicineId: null, name: 'Custom Syringe', quantity: 12, isCustom: true, isUrgent: false, status: 'pending' },
                    { _id: itemA4ForwardedId, medicineId: '64f00000000000000000a004', name: 'Paracetamol 500mg', quantity: 20, isCustom: false, isUrgent: false, status: 'forwarded' },
                ],
            }),
            cloneRequestRecord({
                _id: reqBranchBPartialId,
                pharmacistId: branchBId,
                submittedBy: 'Dr. Khalid',
                status: 'partially_fulfilled',
                forwardingProcessed: false,
                createdAt: new Date(),
                items: [
                    { _id: itemB1PackedId, medicineId: '64f00000000000000000b001', name: 'Azithromycin 250mg', quantity: 8, isCustom: false, isUrgent: false, status: 'packed' },
                    { _id: itemB2PendingId, medicineId: '64f00000000000000000b002', name: 'Atorvastatin 20mg', quantity: 15, isCustom: false, isUrgent: true, status: 'pending' },
                ],
            }),
            cloneRequestRecord({
                _id: reqBranchAPendingId,
                pharmacistId: branchAId,
                submittedBy: 'Dr. Amina',
                status: 'pending',
                forwardingProcessed: false,
                createdAt: new Date(),
                items: [
                    { _id: itemPend1Id, medicineId: '64f00000000000000000c001', name: 'Omeprazole 20mg', quantity: 4, isCustom: false, isUrgent: false, status: 'pending' },
                ],
            }),
            cloneRequestRecord({
                _id: reqBranchARejectedId,
                pharmacistId: branchAId,
                submittedBy: 'Dr. Amina',
                status: 'rejected',
                forwardingProcessed: false,
                createdAt: new Date(),
                items: [
                    { _id: itemRej1Id, medicineId: '64f00000000000000000d001', name: 'Cetirizine 10mg', quantity: 6, isCustom: false, isUrgent: false, status: 'pending' },
                ],
            }),
            cloneRequestRecord({
                _id: reqBranchAProcessedId,
                pharmacistId: branchAId,
                submittedBy: 'Dr. Amina',
                status: 'unfulfilled',
                forwardingProcessed: true,
                createdAt: new Date(),
                items: [
                    { _id: itemProc1Id, medicineId: '64f00000000000000000e001', name: 'Metformin 500mg', quantity: 30, isCustom: false, isUrgent: false, status: 'forwarded' },
                ],
            }),
            cloneRequestRecord({
                _id: reqBranchAApprovedId,
                pharmacistId: branchAId,
                submittedBy: 'Dr. Amina',
                status: 'approved',
                forwardingProcessed: false,
                createdAt: new Date(),
                items: [
                    { _id: itemAppr1Id, medicineId: '64f00000000000000000f001', name: 'Losartan 50mg', quantity: 7, isCustom: false, isUrgent: false, status: 'pending' },
                ],
            }),
            cloneRequestRecord({
                _id: reqBranchACompletedId,
                pharmacistId: branchAId,
                submittedBy: 'Dr. Amina',
                status: 'completed',
                forwardingProcessed: false,
                createdAt: new Date(),
                items: [
                    { _id: itemComp1Id, medicineId: '64f00000000000000000f002', name: 'Vitamin D3', quantity: 9, isCustom: false, isUrgent: false, status: 'pending' },
                ],
            }),
            cloneRequestRecord({
                _id: reqBranchAUnfulfilledId,
                pharmacistId: branchAId,
                submittedBy: 'Dr. Amina',
                status: 'unfulfilled',
                forwardingProcessed: false,
                createdAt: new Date(),
                items: [
                    { _id: itemUnful1Id, medicineId: '64f00000000000000000f003', name: 'Salbutamol Inhaler', quantity: 3, isCustom: false, isUrgent: true, status: 'pending' },
                ],
            }),
        ];

        vi.spyOn(User, 'findById').mockImplementation((id) => {
            const match = userRecords.find((u) => String(u._id) === String(id)) || null;
            return makeChainQuery(match);
        });

        vi.spyOn(Branch, 'findById').mockImplementation((id) => {
            const match = branchRecords.find((b) => String(b._id) === String(id)) || null;
            return makeChainQuery(match);
        });

        vi.spyOn(PharmacistRequest, 'findById').mockImplementation(async (id) => {
            const match = requestRecords.find((r) => String(r._id) === String(id)) || null;
            return match ? cloneRequestRecord(match) : null;
        });

        vi.spyOn(PharmacistRequest, 'findOneAndUpdate').mockImplementation(async (filter = {}, update = {}, options = {}) => {
            updateCallCount += 1;
            const doc = requestRecords.find((r) => {
                if (filter._id !== undefined && String(r._id) !== String(filter._id)) return false;
                if (filter.pharmacistId !== undefined && String(r.pharmacistId) !== String(filter.pharmacistId)) return false;
                if (filter.forwardingProcessed !== undefined) {
                    if (typeof filter.forwardingProcessed === 'object' && filter.forwardingProcessed !== null && '$ne' in filter.forwardingProcessed) {
                        if (r.forwardingProcessed === filter.forwardingProcessed.$ne) return false;
                    } else if (Boolean(r.forwardingProcessed) !== Boolean(filter.forwardingProcessed)) {
                        return false;
                    }
                }
                if (filter.status?.$in && !filter.status.$in.includes(r.status)) return false;
                if (filter.items?.$elemMatch) {
                    const elemIdIn = (filter.items.$elemMatch._id?.$in || []).map(String);
                    const elemStatusNin = filter.items.$elemMatch.status?.$nin || [];
                    const hasMatch = r.items.some((item) => elemIdIn.includes(String(item._id)) && !elemStatusNin.includes(item.status));
                    if (!hasMatch) return false;
                }
                return true;
            });

            if (!doc) return null;

            if (update.$set?.forwardingProcessed !== undefined) {
                doc.forwardingProcessed = update.$set.forwardingProcessed;
            }
            const elemFilter = (options.arrayFilters || []).find((f) => f['elem._id']) || {};
            const targetIds = (elemFilter['elem._id']?.$in || []).map(String);
            const excludedStatuses = elemFilter['elem.status']?.$nin || [];
            if (update.$set?.['items.$[elem].status']) {
                doc.items.forEach((item) => {
                    if (targetIds.includes(String(item._id)) && !excludedStatuses.includes(item.status)) {
                        item.status = update.$set['items.$[elem].status'];
                    }
                });
            }
            return cloneRequestRecord(doc);
        });

        vi.spyOn(PharmacistRequest, 'countDocuments').mockImplementation(async (query = {}) => {
            lastCountQuery = query;
            return requestRecords.filter((r) => {
                if (query.pharmacistId !== undefined && String(r.pharmacistId) !== String(query.pharmacistId)) {
                    return false;
                }
                if (query.createdAt?.$gte && r.createdAt < query.createdAt.$gte) {
                    return false;
                }
                return true;
            }).length;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('H2-1: POST /api/requests/:id/forward Authorization', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app)
                .post(`/api/requests/${reqBranchAPartialId}/forward`)
                .send({ itemsToForward: [itemA2PendingId] });

            expect(res.status).toBe(401);
            expect(updateCallCount).toBe(0);
        });

        it('allows a branch user to forward eligible items from their own request and preserves response shape', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const res = await request(app)
                .post(`/api/requests/${reqBranchAPartialId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemA2PendingId] });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: 'Successfully forwarded 1 items.',
                forwardedItems: [
                    {
                        _id: itemA2PendingId,
                        medicineId: '64f00000000000000000a002',
                        name: 'Insulin Glargine',
                        quantity: 5,
                        isCustom: false,
                        isUrgent: true,
                    },
                ],
            });
            expect(updateCallCount).toBe(1);
        });

        it('blocks Branch A from forwarding Branch B request with 403 before body validation and leaves all request data unchanged', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const res = await request(app)
                .post(`/api/requests/${reqBranchBPartialId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemB2PendingId] });

            expect(res.status).toBe(403);
            expect(updateCallCount).toBe(0);

            // Empty itemsToForward against another branch still returns 403 (ownership before body checks)
            const emptyCrossBranchRes = await request(app)
                .post(`/api/requests/${reqBranchBPartialId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [] });
            expect(emptyCrossBranchRes.status).toBe(403);
            expect(updateCallCount).toBe(0);

            const victim = requestRecords.find((r) => r._id === reqBranchBPartialId);
            expect(victim.forwardingProcessed).toBe(false);
            expect(victim.items.find((i) => i._id === itemB1PackedId).status).toBe('packed');
            expect(victim.items.find((i) => i._id === itemB2PendingId).status).toBe('pending');
        });

        it('denies Store Staff without forward_requests with 403 and zero mutations', async () => {
            const unprivilegedToken = signAuthToken({ id: unprivilegedStaffId, role: 'admin' });

            const res = await request(app)
                .post(`/api/requests/${reqBranchBPartialId}/forward`)
                .set('Authorization', `Bearer ${unprivilegedToken}`)
                .send({ itemsToForward: [itemB2PendingId] });

            expect(res.status).toBe(403);
            expect(updateCallCount).toBe(0);
            expect(requestRecords.find((r) => r._id === reqBranchBPartialId).forwardingProcessed).toBe(false);
        });

        it('allows Store Staff with explicit forward_requests permission', async () => {
            const forwarderToken = signAuthToken({ id: forwarderStaffId, role: 'admin' });

            const res = await request(app)
                .post(`/api/requests/${reqBranchBPartialId}/forward`)
                .set('Authorization', `Bearer ${forwarderToken}`)
                .send({ itemsToForward: [itemB2PendingId] });

            expect(res.status).toBe(200);
            expect(res.body.forwardedItems).toHaveLength(1);
            expect(res.body.forwardedItems[0]._id).toBe(itemB2PendingId);
            expect(updateCallCount).toBe(1);
        });

        it('allows Store Staff with legacy requests permission mapping', async () => {
            const legacyToken = signAuthToken({ id: legacyRequestsStaffId, role: 'admin' });

            const res = await request(app)
                .post(`/api/requests/${reqBranchBPartialId}/forward`)
                .set('Authorization', `Bearer ${legacyToken}`)
                .send({ itemsToForward: [itemB2PendingId] });

            expect(res.status).toBe(200);
            expect(res.body.forwardedItems).toHaveLength(1);
        });

        it('allows Super Admin bypass to forward requests', async () => {
            const superAdminToken = signAuthToken({ id: superAdminId, role: 'admin' });

            const res = await request(app)
                .post(`/api/requests/${reqBranchBPartialId}/forward`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({ itemsToForward: [itemB2PendingId] });

            expect(res.status).toBe(200);
            expect(res.body.forwardedItems).toHaveLength(1);
        });

        it('rejects unknown roles with 403 at both middleware and controller level', async () => {
            userRecords.push({ _id: '64f000000000000000000099', username: 'unknown_user', role: 'auditor', isSuperAdmin: false, permissions: [] });
            const unknownUserToken = signAuthToken({ id: '64f000000000000000000099', role: 'auditor' });

            const routeRes = await request(app)
                .post(`/api/requests/${reqBranchAPartialId}/forward`)
                .set('Authorization', `Bearer ${unknownUserToken}`)
                .send({ itemsToForward: [itemA2PendingId] });
            expect(routeRes.status).toBe(403);

            const mockRes = createMockRes();
            await forwardItems(
                {
                    user: { _id: branchAId, role: 'guest', permissions: [] },
                    params: { id: reqBranchAPartialId },
                    body: { itemsToForward: [itemA2PendingId] },
                },
                mockRes
            );
            expect(mockRes.statusCode).toBe(403);
            expect(updateCallCount).toBe(0);
        });
    });

    describe('H2-1: POST /api/requests/:id/forward Validation, State & Deduplication', () => {
        it('returns 400 for invalid request ID and 404 when request is missing', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            const invalidRes = await request(app)
                .post('/api/requests/not-a-valid-id/forward')
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemA2PendingId] });
            expect(invalidRes.status).toBe(400);

            const missingRes = await request(app)
                .post(`/api/requests/${missingRequestId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemA2PendingId] });
            expect(missingRes.status).toBe(404);
            expect(updateCallCount).toBe(0);
        });

        it('returns 400 when itemsToForward is missing, empty, non-array, or contains invalid/foreign item IDs without locking request', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            for (const body of [
                {},
                { itemsToForward: [] },
                { itemsToForward: 'all' },
                { itemsToForward: { $ne: '' } },
                { itemsToForward: ['invalid-item-id'] },
                { itemsToForward: [foreignItemId] },
            ]) {
                const res = await request(app)
                    .post(`/api/requests/${reqBranchAPartialId}/forward`)
                    .set('Authorization', `Bearer ${branchAToken}`)
                    .send(body);
                expect(res.status).toBe(400);
            }

            expect(updateCallCount).toBe(0);
            expect(requestRecords.find((r) => r._id === reqBranchAPartialId).forwardingProcessed).toBe(false);
        });

        it('rejects pending, approved, rejected, and already forwardingProcessed requests with 400, while allowing completed and unfulfilled', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            for (const [reqId, itemId] of [
                [reqBranchAPendingId, itemPend1Id],
                [reqBranchAApprovedId, itemAppr1Id],
                [reqBranchARejectedId, itemRej1Id],
                [reqBranchAProcessedId, itemProc1Id],
            ]) {
                const rejectedRes = await request(app)
                    .post(`/api/requests/${reqId}/forward`)
                    .set('Authorization', `Bearer ${branchAToken}`)
                    .send({ itemsToForward: [itemId] });
                expect(rejectedRes.status).toBe(400);
            }
            expect(updateCallCount).toBe(0);

            const completedRes = await request(app)
                .post(`/api/requests/${reqBranchACompletedId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemComp1Id] });
            expect(completedRes.status).toBe(200);

            const unfulfilledRes = await request(app)
                .post(`/api/requests/${reqBranchAUnfulfilledId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemUnful1Id] });
            expect(unfulfilledRes.status).toBe(200);
        });

        it('never alters packed, already forwarded, or unselected items, deduplicates item IDs, and returns 409 on race loss', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });

            // Attempt selecting only packed and already-forwarded items -> 400 and NO lock
            const onlyIneligibleRes = await request(app)
                .post(`/api/requests/${reqBranchAPartialId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemA1PackedId, itemA4ForwardedId] });

            expect(onlyIneligibleRes.status).toBe(400);
            expect(updateCallCount).toBe(0);
            expect(requestRecords.find((r) => r._id === reqBranchAPartialId).forwardingProcessed).toBe(false);

            // Simulate losing atomic race when findOneAndUpdate returns null
            vi.spyOn(PharmacistRequest, 'findOneAndUpdate').mockResolvedValueOnce(null);
            const raceLossRes = await request(app)
                .post(`/api/requests/${reqBranchAPartialId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemA2PendingId] });
            expect(raceLossRes.status).toBe(409);

            // Send duplicate ID alongside packed item while leaving itemA3 unselected -> deduplicated single forwarded item
            const mixedRes = await request(app)
                .post(`/api/requests/${reqBranchAPartialId}/forward`)
                .set('Authorization', `Bearer ${branchAToken}`)
                .send({ itemsToForward: [itemA1PackedId, itemA2PendingId, itemA2PendingId] });

            expect(mixedRes.status).toBe(200);
            expect(mixedRes.body.forwardedItems.map((i) => i._id)).toEqual([itemA2PendingId]);

            const updated = requestRecords.find((r) => r._id === reqBranchAPartialId);
            expect(updated.forwardingProcessed).toBe(true);
            expect(updated.items.find((i) => i._id === itemA1PackedId).status).toBe('packed');
            expect(updated.items.find((i) => i._id === itemA2PendingId).status).toBe('forwarded');
            expect(updated.items.find((i) => i._id === itemA3PendingUnselectedId).status).toBe('pending');
            expect(updated.items.find((i) => i._id === itemA4ForwardedId).status).toBe('forwarded');
        });
    });

    describe('H2-2: GET /api/requests/stats Authorization & Branch Scoping', () => {
        it('returns 401 when unauthenticated and 403 for unprivileged Store Staff', async () => {
            const unauthRes = await request(app).get('/api/requests/stats');
            expect(unauthRes.status).toBe(401);

            const unprivilegedToken = signAuthToken({ id: unprivilegedStaffId, role: 'admin' });
            const deniedRes = await request(app)
                .get('/api/requests/stats')
                .set('Authorization', `Bearer ${unprivilegedToken}`);
            expect(deniedRes.status).toBe(403);
        });

        it('allows Store Staff with view_requests, legacy requests permission, and Super Admin', async () => {
            for (const userId of [viewRequestsStaffId, legacyRequestsStaffId, superAdminId]) {
                const token = signAuthToken({ id: userId, role: 'admin' });
                const res = await request(app)
                    .get('/api/requests/stats')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body).toEqual({ todayParams: 8 });
                expect(lastCountQuery).not.toHaveProperty('pharmacistId');
            }
        });

        it('scopes statistics strictly to the authenticated branch user own requests', async () => {
            const branchAToken = signAuthToken({ id: branchAId, role: 'branch' });
            const res = await request(app)
                .get('/api/requests/stats')
                .set('Authorization', `Bearer ${branchAToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ todayParams: 7 });
            expect(String(lastCountQuery.pharmacistId)).toBe(branchAId);
        });

        it('rejects unknown roles with 403 at both route and controller level', async () => {
            userRecords.push({ _id: '64f000000000000000000099', username: 'unknown_user', role: 'auditor', isSuperAdmin: false, permissions: [] });
            const unknownToken = signAuthToken({ id: '64f000000000000000000099', role: 'auditor' });

            const routeRes = await request(app)
                .get('/api/requests/stats')
                .set('Authorization', `Bearer ${unknownToken}`);
            expect(routeRes.status).toBe(403);

            const mockRes = createMockRes();
            await getStats({ user: { _id: branchAId, role: 'guest', permissions: [] } }, mockRes);
            expect(mockRes.statusCode).toBe(403);
        });
    });
});

describe('H2 Concurrency Guarantee (Real MongoMemoryServer Database)', () => {
    let app;

    beforeEach(() => {
        app = createTestApp();
    });

    it('permits exactly one winner and rejects the second request with 409 when two identical forwards execute concurrently', async () => {
        const branch = await Branch.create({ name: 'Concurrent Branch A', password: 'BranchSecretPassword!1' });
        const reqDoc = await PharmacistRequest.create({
            pharmacistId: branch._id,
            submittedBy: 'Dr. Concurrency Test',
            status: 'partially_fulfilled',
            forwardingProcessed: false,
            items: [
                { medicineId: new mongoose.Types.ObjectId(), name: 'Packed Med', quantity: 5, isCustom: false, isUrgent: false, status: 'packed' },
                { medicineId: new mongoose.Types.ObjectId(), name: 'Pending Med 1', quantity: 10, isCustom: false, isUrgent: true, status: 'pending' },
                { medicineId: new mongoose.Types.ObjectId(), name: 'Pending Med 2', quantity: 3, isCustom: false, isUrgent: false, status: 'pending' },
            ],
        });

        const [packedItem, pendingItem1, pendingItem2] = reqDoc.items;
        const token = signAuthToken({ id: branch._id, role: 'branch' });

        const [res1, res2] = await Promise.all([
            request(app)
                .post(`/api/requests/${reqDoc._id}/forward`)
                .set('Authorization', `Bearer ${token}`)
                .send({ itemsToForward: [pendingItem1._id.toString()] }),
            request(app)
                .post(`/api/requests/${reqDoc._id}/forward`)
                .set('Authorization', `Bearer ${token}`)
                .send({ itemsToForward: [pendingItem1._id.toString()] }),
        ]);

        const responses = [res1, res2];
        const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
        expect(statuses).toEqual([200, 409]);

        const winner = responses.find((r) => r.status === 200);
        const loser = responses.find((r) => r.status === 409);
        expect(winner.body.forwardedItems).toHaveLength(1);
        expect(winner.body.forwardedItems[0]._id).toBe(pendingItem1._id.toString());
        expect(loser.body.forwardedItems).toBeUndefined();

        const freshDoc = await PharmacistRequest.findById(reqDoc._id);
        expect(freshDoc.forwardingProcessed).toBe(true);
        expect(freshDoc.items.id(packedItem._id).status).toBe('packed');
        expect(freshDoc.items.id(pendingItem1._id).status).toBe('forwarded');
        expect(freshDoc.items.id(pendingItem2._id).status).toBe('pending');
    });

    it('prevents split-selection concurrent forwards from bypassing the single forwardingProcessed lock', async () => {
        const branch = await Branch.create({ name: 'Concurrent Branch B', password: 'BranchSecretPassword!2' });
        const reqDoc = await PharmacistRequest.create({
            pharmacistId: branch._id,
            submittedBy: 'Dr. Split Race',
            status: 'unfulfilled',
            forwardingProcessed: false,
            items: [
                { medicineId: new mongoose.Types.ObjectId(), name: 'Packed Med', quantity: 2, isCustom: false, isUrgent: false, status: 'packed' },
                { medicineId: new mongoose.Types.ObjectId(), name: 'Pending Alpha', quantity: 4, isCustom: false, isUrgent: false, status: 'pending' },
                { medicineId: new mongoose.Types.ObjectId(), name: 'Pending Beta', quantity: 6, isCustom: false, isUrgent: true, status: 'pending' },
            ],
        });

        const [packedItem, itemAlpha, itemBeta] = reqDoc.items;
        const token = signAuthToken({ id: branch._id, role: 'branch' });

        const [res1, res2] = await Promise.all([
            request(app)
                .post(`/api/requests/${reqDoc._id}/forward`)
                .set('Authorization', `Bearer ${token}`)
                .send({ itemsToForward: [itemAlpha._id.toString()] }),
            request(app)
                .post(`/api/requests/${reqDoc._id}/forward`)
                .set('Authorization', `Bearer ${token}`)
                .send({ itemsToForward: [itemBeta._id.toString()] }),
        ]);

        const responses = [res1, res2];
        expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);

        const winner = responses.find((r) => r.status === 200);
        const forwardedId = winner.body.forwardedItems[0]._id;
        expect([itemAlpha._id.toString(), itemBeta._id.toString()]).toContain(forwardedId);

        const freshDoc = await PharmacistRequest.findById(reqDoc._id);
        expect(freshDoc.forwardingProcessed).toBe(true);
        expect(freshDoc.items.id(packedItem._id).status).toBe('packed');

        const forwardedCount = [freshDoc.items.id(itemAlpha._id), freshDoc.items.id(itemBeta._id)]
            .filter((i) => i.status === 'forwarded').length;
        const pendingCount = [freshDoc.items.id(itemAlpha._id), freshDoc.items.id(itemBeta._id)]
            .filter((i) => i.status === 'pending').length;
        expect(forwardedCount).toBe(1);
        expect(pendingCount).toBe(1);
    });

    it('deduplicates repeated item IDs and preserves packed/unselected items in real MongoDB', async () => {
        const branch = await Branch.create({ name: 'Concurrent Branch C', password: 'BranchSecretPassword!3' });
        const reqDoc = await PharmacistRequest.create({
            pharmacistId: branch._id,
            submittedBy: 'Dr. Dedup Check',
            status: 'completed',
            forwardingProcessed: false,
            items: [
                { medicineId: new mongoose.Types.ObjectId(), name: 'Packed Med', quantity: 1, isCustom: false, isUrgent: false, status: 'packed' },
                { medicineId: new mongoose.Types.ObjectId(), name: 'Eligible Med', quantity: 7, isCustom: false, isUrgent: false, status: 'pending' },
                { medicineId: new mongoose.Types.ObjectId(), name: 'Unselected Med', quantity: 3, isCustom: false, isUrgent: false, status: 'pending' },
            ],
        });

        const [packedItem, eligibleItem, unselectedItem] = reqDoc.items;
        const token = signAuthToken({ id: branch._id, role: 'branch' });

        const res = await request(app)
            .post(`/api/requests/${reqDoc._id}/forward`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                itemsToForward: [
                    packedItem._id.toString(),
                    eligibleItem._id.toString(),
                    eligibleItem._id.toString(),
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body.forwardedItems).toHaveLength(1);
        expect(res.body.forwardedItems[0]._id).toBe(eligibleItem._id.toString());

        const freshDoc = await PharmacistRequest.findById(reqDoc._id);
        expect(freshDoc.forwardingProcessed).toBe(true);
        expect(freshDoc.items.id(packedItem._id).status).toBe('packed');
        expect(freshDoc.items.id(eligibleItem._id).status).toBe('forwarded');
        expect(freshDoc.items.id(unselectedItem._id).status).toBe('pending');
    });

    it('forwards an eligible legacy MongoDB document missing forwardingProcessed and persists forwardingProcessed: true', async () => {
        const branch = await Branch.create({ name: 'Legacy Branch Single', password: 'BranchSecretPassword!4' });
        const rawRequestId = new mongoose.Types.ObjectId();
        const packedItemId = new mongoose.Types.ObjectId();
        const pendingItemId = new mongoose.Types.ObjectId();
        const unselectedItemId = new mongoose.Types.ObjectId();

        await PharmacistRequest.collection.insertOne({
            _id: rawRequestId,
            pharmacistId: branch._id,
            submittedBy: 'Dr. Legacy Forward',
            status: 'partially_fulfilled',
            items: [
                { _id: packedItemId, medicineId: new mongoose.Types.ObjectId(), name: 'Packed Legacy Med', quantity: 2, isCustom: false, isUrgent: false, status: 'packed' },
                { _id: pendingItemId, medicineId: new mongoose.Types.ObjectId(), name: 'Pending Legacy Med', quantity: 6, isCustom: false, isUrgent: true, status: 'pending' },
                { _id: unselectedItemId, medicineId: new mongoose.Types.ObjectId(), name: 'Unselected Legacy Med', quantity: 4, isCustom: false, isUrgent: false, status: 'pending' },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const rawBefore = await PharmacistRequest.collection.findOne({ _id: rawRequestId });
        expect(rawBefore).not.toBeNull();
        expect('forwardingProcessed' in rawBefore).toBe(false);

        const token = signAuthToken({ id: branch._id, role: 'branch' });
        const res = await request(app)
            .post(`/api/requests/${rawRequestId.toString()}/forward`)
            .set('Authorization', `Bearer ${token}`)
            .send({ itemsToForward: [pendingItemId.toString()] });

        expect(res.status).toBe(200);
        expect(res.body.forwardedItems).toHaveLength(1);
        expect(res.body.forwardedItems[0]._id).toBe(pendingItemId.toString());

        const rawAfter = await PharmacistRequest.collection.findOne({ _id: rawRequestId });
        expect(rawAfter.forwardingProcessed).toBe(true);
        expect(rawAfter.items.find((i) => i._id.toString() === packedItemId.toString()).status).toBe('packed');
        expect(rawAfter.items.find((i) => i._id.toString() === pendingItemId.toString()).status).toBe('forwarded');
        expect(rawAfter.items.find((i) => i._id.toString() === unselectedItemId.toString()).status).toBe('pending');

        // Subsequent forward attempt is now blocked
        const repeatRes = await request(app)
            .post(`/api/requests/${rawRequestId.toString()}/forward`)
            .set('Authorization', `Bearer ${token}`)
            .send({ itemsToForward: [unselectedItemId.toString()] });
        expect(repeatRes.status).toBe(400);
    });

    it('prevents concurrent duplicate forwarding on a legacy MongoDB document missing forwardingProcessed', async () => {
        const branch = await Branch.create({ name: 'Legacy Branch Race', password: 'BranchSecretPassword!5' });
        const rawRequestId = new mongoose.Types.ObjectId();
        const packedItemId = new mongoose.Types.ObjectId();
        const itemAlphaId = new mongoose.Types.ObjectId();
        const itemBetaId = new mongoose.Types.ObjectId();

        await PharmacistRequest.collection.insertOne({
            _id: rawRequestId,
            pharmacistId: branch._id,
            submittedBy: 'Dr. Legacy Race',
            status: 'unfulfilled',
            items: [
                { _id: packedItemId, medicineId: new mongoose.Types.ObjectId(), name: 'Packed Legacy Race', quantity: 1, isCustom: false, isUrgent: false, status: 'packed' },
                { _id: itemAlphaId, medicineId: new mongoose.Types.ObjectId(), name: 'Legacy Alpha', quantity: 5, isCustom: false, isUrgent: false, status: 'pending' },
                { _id: itemBetaId, medicineId: new mongoose.Types.ObjectId(), name: 'Legacy Beta', quantity: 8, isCustom: false, isUrgent: true, status: 'pending' },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const rawBefore = await PharmacistRequest.collection.findOne({ _id: rawRequestId });
        expect('forwardingProcessed' in rawBefore).toBe(false);

        const token = signAuthToken({ id: branch._id, role: 'branch' });
        const [res1, res2] = await Promise.all([
            request(app)
                .post(`/api/requests/${rawRequestId.toString()}/forward`)
                .set('Authorization', `Bearer ${token}`)
                .send({ itemsToForward: [itemAlphaId.toString()] }),
            request(app)
                .post(`/api/requests/${rawRequestId.toString()}/forward`)
                .set('Authorization', `Bearer ${token}`)
                .send({ itemsToForward: [itemBetaId.toString()] }),
        ]);

        const responses = [res1, res2];
        expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);

        const winner = responses.find((r) => r.status === 200);
        const loser = responses.find((r) => r.status === 409);
        expect(winner.body.forwardedItems).toHaveLength(1);
        expect([itemAlphaId.toString(), itemBetaId.toString()]).toContain(winner.body.forwardedItems[0]._id);
        expect(loser.body.forwardedItems).toBeUndefined();

        const rawAfter = await PharmacistRequest.collection.findOne({ _id: rawRequestId });
        expect(rawAfter.forwardingProcessed).toBe(true);
        expect(rawAfter.items.find((i) => i._id.toString() === packedItemId.toString()).status).toBe('packed');

        const forwardedCount = [itemAlphaId, itemBetaId]
            .map((id) => rawAfter.items.find((i) => i._id.toString() === id.toString()).status)
            .filter((status) => status === 'forwarded').length;
        const pendingCount = [itemAlphaId, itemBetaId]
            .map((id) => rawAfter.items.find((i) => i._id.toString() === id.toString()).status)
            .filter((status) => status === 'pending').length;
        expect(forwardedCount).toBe(1);
        expect(pendingCount).toBe(1);
    });
});
