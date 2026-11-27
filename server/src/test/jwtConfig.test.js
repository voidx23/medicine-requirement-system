import crypto from 'crypto';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { describe, it, expect, afterEach } from 'vitest';
import {
    validateJwtConfig,
    getJwtSecret,
    signAuthToken,
    verifyAuthToken,
    signStaffVerificationToken,
    verifyStaffVerificationToken,
    STAFF_VERIFICATION_PURPOSE,
    JWT_EXPIRES_IN,
    MIN_JWT_SECRET_LENGTH,
} from '../config/jwtConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '../..');

function makeRandomSecret(byteLength = 24) {
    return crypto.randomBytes(byteLength).toString('hex');
}

describe('JWT Secret Configuration & Validation (Phase 1A)', () => {
    const originalEnvSecret = process.env.JWT_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        if (originalEnvSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalEnvSecret;
        }
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }
    });

    it('rejects missing JWT_SECRET in production and non-test environments', () => {
        expect(() => validateJwtConfig({ NODE_ENV: 'production' })).toThrow(/required/i);
        expect(() => validateJwtConfig({ NODE_ENV: 'development' })).toThrow(/required/i);
        expect(() => validateJwtConfig({})).toThrow(/required/i);
        expect(() => getJwtSecret({ NODE_ENV: 'production' })).toThrow(/required/i);
    });

    it('rejects empty and whitespace-only JWT_SECRET values', () => {
        expect(() => validateJwtConfig({ NODE_ENV: 'production', JWT_SECRET: '' })).toThrow(/must not be empty/i);
        expect(() => validateJwtConfig({ NODE_ENV: 'production', JWT_SECRET: '   \t\n  ' })).toThrow(/must not be empty/i);
        expect(() => validateJwtConfig({ NODE_ENV: 'test', JWT_SECRET: '' })).toThrow(/must not be empty/i);
    });

    it('rejects short JWT_SECRET values under 32 characters', () => {
        const shortSecret = makeRandomSecret(8); // 16 hex chars (< 32)
        expect(shortSecret.length).toBeLessThan(MIN_JWT_SECRET_LENGTH);

        expect(() => validateJwtConfig({ NODE_ENV: 'production', JWT_SECRET: shortSecret })).toThrow(/at least 32 characters/i);
        expect(() => validateJwtConfig({ NODE_ENV: 'development', JWT_SECRET: shortSecret })).toThrow(/at least 32 characters/i);
        expect(() => validateJwtConfig({ NODE_ENV: 'test', JWT_SECRET: shortSecret })).toThrow(/at least 32 characters/i);
    });

    it('rejects the retired insecure fallback placeholder in all environments', () => {
        const retiredPlaceholder = ['fallback', 'secret', 'dev', 'only'].join('_');

        expect(() => validateJwtConfig({ NODE_ENV: 'production', JWT_SECRET: retiredPlaceholder })).toThrow(/insecure placeholder/i);
        expect(() => validateJwtConfig({ NODE_ENV: 'test', JWT_SECRET: retiredPlaceholder })).toThrow(/insecure placeholder/i);
        expect(() => validateJwtConfig({ NODE_ENV: 'production', JWT_SECRET: `  ${retiredPlaceholder}  ` })).toThrow(/insecure placeholder/i);
    });

    it('allows an ephemeral per-process test secret strictly when NODE_ENV === "test" and JWT_SECRET is omitted', () => {
        const status = validateJwtConfig({ NODE_ENV: 'test' });
        expect(status).toEqual({
            valid: true,
            configured: false,
            usingTestSecret: true,
            meetsMinLength: true,
        });

        const secret1 = getJwtSecret({ NODE_ENV: 'test' });
        const secret2 = getJwtSecret({ NODE_ENV: 'test' });
        expect(typeof secret1).toBe('string');
        expect(secret1.length).toBeGreaterThanOrEqual(32);
        expect(secret1).toBe(secret2);

        // Does not weaken production validation when called with production env
        expect(() => validateJwtConfig({ NODE_ENV: 'production' })).toThrow(/required/i);
    });

    it('accepts a strong secret (>= 32 chars) and preserves HS256 algorithm, payloads, and 30d expiry', () => {
        const strongSecret = makeRandomSecret(32); // 64 hex chars
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = strongSecret;

        const status = validateJwtConfig();
        expect(status).toEqual({
            valid: true,
            configured: true,
            usingTestSecret: false,
            meetsMinLength: true,
        });
        expect(JWT_EXPIRES_IN).toBe('30d');

        // User token payload: { id }
        const userToken = signAuthToken({ id: '507f1f77bcf86cd799439011' });
        const decodedHeader = jwt.decode(userToken, { complete: true }).header;
        expect(decodedHeader.alg).toBe('HS256');

        const verifiedUser = verifyAuthToken(userToken);
        expect(verifiedUser.id).toBe('507f1f77bcf86cd799439011');
        expect(verifiedUser.exp - verifiedUser.iat).toBe(30 * 24 * 60 * 60);

        // Branch token payload: { id, role: 'branch' }
        const branchToken = signAuthToken({ id: '507f1f77bcf86cd799439022', role: 'branch' });
        const verifiedBranch = verifyAuthToken(branchToken);
        expect(verifiedBranch.id).toBe('507f1f77bcf86cd799439022');
        expect(verifiedBranch.role).toBe('branch');
        expect(verifiedBranch.exp - verifiedBranch.iat).toBe(30 * 24 * 60 * 60);
    });

    it('fails closed before listening when server.js starts in production without a valid JWT_SECRET', () => {
        const result = spawnSync(process.execPath, ['src/server.js'], {
            cwd: SERVER_DIR,
            env: {
                ...process.env,
                NODE_ENV: 'production',
                JWT_SECRET: '',
            },
            encoding: 'utf8',
            timeout: 12000,
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('JWT configuration error');
        expect(result.stdout).not.toContain('Server running');
    }, 15000);

    it('rejects request_submission verification tokens in verifyAuthToken and enforces strict claim/alg validation in verifyStaffVerificationToken', () => {
        const strongSecret = makeRandomSecret(32);
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = strongSecret;

        const verificationToken = signStaffVerificationToken({
            branchId: '64f0000000000000000000a1',
            staffId: '64f000000000000000000101',
            staffName: 'Dr. Amina Al Balushi',
        });
        expect(() => verifyAuthToken(verificationToken)).toThrow(/cannot be used for authentication/i);

        const purposePoisonedAuth = jwt.sign(
            { id: '64f0000000000000000000a1', purpose: STAFF_VERIFICATION_PURPOSE },
            strongSecret,
            { algorithm: 'HS256', expiresIn: '5m' }
        );
        expect(() => verifyAuthToken(purposePoisonedAuth)).toThrow(/cannot be used for authentication/i);

        // Valid audience + wrong purpose
        const badPurpose = jwt.sign(
            {
                branchId: '64f0000000000000000000a1',
                staffId: '64f000000000000000000101',
                staffName: 'Dr. Amina',
                purpose: 'wrong_purpose',
            },
            strongSecret,
            { algorithm: 'HS256', expiresIn: '5m', audience: STAFF_VERIFICATION_PURPOSE, jwtid: 'jti-1' }
        );
        expect(() => verifyStaffVerificationToken(badPurpose)).toThrow();

        // Wrong audience + valid purpose
        const badAud = jwt.sign(
            {
                branchId: '64f0000000000000000000a1',
                staffId: '64f000000000000000000101',
                staffName: 'Dr. Amina',
                purpose: STAFF_VERIFICATION_PURPOSE,
            },
            strongSecret,
            { algorithm: 'HS256', expiresIn: '5m', audience: 'wrong_aud', jwtid: 'jti-2' }
        );
        expect(() => verifyStaffVerificationToken(badAud)).toThrow();

        // Blank/whitespace jti
        const blankJti = jwt.sign(
            {
                branchId: '64f0000000000000000000a1',
                staffId: '64f000000000000000000101',
                staffName: 'Dr. Amina',
                purpose: STAFF_VERIFICATION_PURPOSE,
            },
            strongSecret,
            { algorithm: 'HS256', expiresIn: '5m', audience: STAFF_VERIFICATION_PURPOSE, jwtid: '   ' }
        );
        expect(() => verifyStaffVerificationToken(blankJti)).toThrow();

        // Missing numeric exp
        const noExp = jwt.sign(
            {
                branchId: '64f0000000000000000000a1',
                staffId: '64f000000000000000000101',
                staffName: 'Dr. Amina',
                purpose: STAFF_VERIFICATION_PURPOSE,
            },
            strongSecret,
            { algorithm: 'HS256', audience: STAFF_VERIFICATION_PURPOSE, jwtid: 'jti-3' }
        );
        expect(() => verifyStaffVerificationToken(noExp)).toThrow();

        // Unsupported algorithms (HS384, HS512, none)
        for (const alg of ['HS384', 'HS512', 'none']) {
            const badAlg = jwt.sign(
                {
                    branchId: '64f0000000000000000000a1',
                    staffId: '64f000000000000000000101',
                    staffName: 'Dr. Amina',
                    purpose: STAFF_VERIFICATION_PURPOSE,
                },
                alg === 'none' ? '' : strongSecret,
                { algorithm: alg, expiresIn: '5m', audience: STAFF_VERIFICATION_PURPOSE, jwtid: `jti-${alg}` }
            );
            expect(() => verifyStaffVerificationToken(badAlg)).toThrow();
        }
    });
});
