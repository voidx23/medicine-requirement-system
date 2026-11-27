import { describe, it, expect, vi, beforeEach } from 'vitest';
import connectDB, { ensureRequiredIndexes } from '../config/db.js';
import { startServer } from '../server.js';
import UsedVerificationToken from '../models/UsedVerificationToken.js';
import PharmacistRequest from '../models/PharmacistRequest.js';

describe('Server Startup & Replay-Protection Index Guarantee (H2-3 Phase 4A)', () => {
    beforeEach(async () => {
        await PharmacistRequest.init();
        await UsedVerificationToken.collection.dropIndexes().catch(() => {});
    });

    it('ensureRequiredIndexes explicitly creates and verifies unique jti and TTL expiresAt indexes without modifying PharmacistRequest', async () => {
        const beforeRequestIndexes = await PharmacistRequest.collection.indexes();
        const createIndexesSpy = vi.spyOn(UsedVerificationToken, 'createIndexes');
        const requestCreateIndexesSpy = vi.spyOn(PharmacistRequest, 'createIndexes');

        const result = await ensureRequiredIndexes({ tokenModel: UsedVerificationToken });

        expect(createIndexesSpy).toHaveBeenCalledTimes(1);
        expect(requestCreateIndexesSpy).not.toHaveBeenCalled();
        expect(result.jtiIndex).toBeDefined();
        expect(result.jtiIndex.unique).toBe(true);
        expect(result.ttlIndex).toBeDefined();
        expect(result.ttlIndex.expireAfterSeconds).toBe(0);

        const afterRequestIndexes = await PharmacistRequest.collection.indexes();
        expect(afterRequestIndexes.map((i) => i.name)).toEqual(beforeRequestIndexes.map((i) => i.name));
        createIndexesSpy.mockRestore();
        requestCreateIndexesSpy.mockRestore();
    });

    it('ensureRequiredIndexes rejects if either required index is missing after createIndexes()', async () => {
        const missingJtiModel = {
            createIndexes: vi.fn().mockResolvedValue(undefined),
            collection: {
                indexes: vi.fn().mockResolvedValue([
                    { name: 'expiresAt_1', key: { expiresAt: 1 }, expireAfterSeconds: 0 },
                ]),
            },
        };
        await expect(ensureRequiredIndexes({ tokenModel: missingJtiModel })).rejects.toThrow(/unique.*jti/i);

        const nonUniqueJtiModel = {
            createIndexes: vi.fn().mockResolvedValue(undefined),
            collection: {
                indexes: vi.fn().mockResolvedValue([
                    { name: 'jti_1', key: { jti: 1 }, unique: false },
                    { name: 'expiresAt_1', key: { expiresAt: 1 }, expireAfterSeconds: 0 },
                ]),
            },
        };
        await expect(ensureRequiredIndexes({ tokenModel: nonUniqueJtiModel })).rejects.toThrow(/unique.*jti/i);

        const missingTtlModel = {
            createIndexes: vi.fn().mockResolvedValue(undefined),
            collection: {
                indexes: vi.fn().mockResolvedValue([
                    { name: 'jti_1', key: { jti: 1 }, unique: true },
                ]),
            },
        };
        await expect(ensureRequiredIndexes({ tokenModel: missingTtlModel })).rejects.toThrow(/TTL.*expiresAt/i);
    });

    it('connectDB fails visibly if createIndexes() rejects', async () => {
        const failingTokenModel = {
            createIndexes: vi.fn().mockRejectedValue(new Error('Index build denied')),
            collection: { indexes: vi.fn() },
        };
        const mockMongoose = {
            connect: vi.fn().mockResolvedValue({ connection: { host: 'mock-host' } }),
        };

        await expect(
            connectDB({
                uri: 'mongodb://mock/test',
                mongooseInstance: mockMongoose,
                tokenModel: failingTokenModel,
            })
        ).rejects.toThrow('Index build denied');
    });

    it('startServer awaits database and index initialization before calling listen()', async () => {
        let resolveDb;
        const dbPromise = new Promise((resolve) => {
            resolveDb = resolve;
        });

        const order = [];
        const initializeDb = vi.fn(() => {
            order.push('db-start');
            return dbPromise.then(() => {
                order.push('db-ready');
            });
        });
        const mockServer = { once: vi.fn() };
        const expressApp = {
            listen: vi.fn((port, cb) => {
                order.push('listen');
                cb();
                return mockServer;
            }),
        };

        const startPromise = startServer({
            env: { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(48), PORT: '5055' },
            validateJwt: vi.fn().mockReturnValue({ configured: true, meetsMinLength: true }),
            initializeDb,
            expressApp,
        });

        await Promise.resolve();
        expect(initializeDb).toHaveBeenCalledTimes(1);
        expect(expressApp.listen).not.toHaveBeenCalled();

        resolveDb();
        await startPromise;

        expect(expressApp.listen).toHaveBeenCalledTimes(1);
        expect(order).toEqual(['db-start', 'db-ready', 'listen']);
    });

    it('startServer aborts startup without listening when database/index initialization fails', async () => {
        const expressApp = { listen: vi.fn() };

        await expect(
            startServer({
                env: { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(48) },
                validateJwt: vi.fn().mockReturnValue({ configured: true, meetsMinLength: true }),
                initializeDb: vi.fn().mockRejectedValue(new Error('Required unique { jti: 1 } index missing')),
                expressApp,
            })
        ).rejects.toThrow('Required unique { jti: 1 } index missing');

        expect(expressApp.listen).not.toHaveBeenCalled();
    });
});
