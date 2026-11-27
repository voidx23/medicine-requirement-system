import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const JWT_EXPIRES_IN = '30d';
export const MIN_JWT_SECRET_LENGTH = 32;

// SHA-256 digest of the retired dev placeholder so it is rejected without keeping the literal in source
const KNOWN_INSECURE_SECRET_SHA256 = '55d701477a446f805d60095e7d38be09807d635cffd44eaea3670f9ebd1bda3c';

let ephemeralTestSecret = null;

function sha256Hex(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Validates JWT configuration without exposing secret material.
 * Allows an ephemeral per-process test secret strictly when NODE_ENV === 'test'
 * and JWT_SECRET is not explicitly provided.
 */
export function validateJwtConfig(env = process.env) {
    const isTestEnv = env.NODE_ENV === 'test';

    if (isTestEnv && env.JWT_SECRET === undefined) {
        return {
            valid: true,
            configured: false,
            usingTestSecret: true,
            meetsMinLength: true,
        };
    }

    if (typeof env.JWT_SECRET !== 'string') {
        throw new Error('JWT configuration error: JWT_SECRET environment variable is required.');
    }

    const trimmed = env.JWT_SECRET.trim();
    if (trimmed.length === 0) {
        throw new Error('JWT configuration error: JWT_SECRET environment variable must not be empty.');
    }

    if (
        sha256Hex(env.JWT_SECRET) === KNOWN_INSECURE_SECRET_SHA256 ||
        sha256Hex(trimmed) === KNOWN_INSECURE_SECRET_SHA256
    ) {
        throw new Error('JWT configuration error: JWT_SECRET uses a rejected insecure placeholder value.');
    }

    if (trimmed.length < MIN_JWT_SECRET_LENGTH) {
        throw new Error(`JWT configuration error: JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`);
    }

    return {
        valid: true,
        configured: true,
        usingTestSecret: false,
        meetsMinLength: true,
    };
}

/**
 * Returns the validated JWT signing/verification secret.
 */
export function getJwtSecret(env = process.env) {
    const status = validateJwtConfig(env);
    if (status.usingTestSecret) {
        if (!ephemeralTestSecret) {
            ephemeralTestSecret = crypto.randomBytes(32).toString('hex');
        }
        return ephemeralTestSecret;
    }
    return env.JWT_SECRET;
}

/**
 * Signs an authentication JWT using the centralized secret and 30d lifetime.
 */
export function signAuthToken(payload, options = {}) {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: JWT_EXPIRES_IN,
        ...options,
    });
}

/**
 * Verifies an authentication JWT using the centralized secret.
 */
export function verifyAuthToken(token) {
    return jwt.verify(token, getJwtSecret());
}

export const STAFF_VERIFICATION_EXPIRES_IN = '5m';
export const STAFF_VERIFICATION_EXPIRES_IN_SECONDS = 300;
export const STAFF_VERIFICATION_PURPOSE = 'request_submission';

/**
 * Signs a short-lived single-purpose JWT proving staff PIN verification for request submission.
 * Intentionally excludes auth claims (`id`, `role`) so it cannot be used as a login token.
 */
export function signStaffVerificationToken({ branchId, staffId, staffName }) {
    if (!branchId || !staffId || typeof staffName !== 'string' || !staffName.trim()) {
        throw new Error('branchId, staffId, and staffName are required to sign a staff verification token');
    }

    const payload = {
        branchId: String(branchId),
        staffId: String(staffId),
        staffName: staffName.trim(),
        purpose: STAFF_VERIFICATION_PURPOSE,
    };

    return jwt.sign(payload, getJwtSecret(), {
        algorithm: 'HS256',
        expiresIn: STAFF_VERIFICATION_EXPIRES_IN,
        audience: STAFF_VERIFICATION_PURPOSE,
        jwtid: crypto.randomUUID(),
    });
}

/**
 * Verifies a staff verification token for request submission and rejects auth-shaped tokens.
 */
export function verifyStaffVerificationToken(token) {
    if (typeof token !== 'string' || !token.trim()) {
        const err = new Error('Missing verification token');
        err.name = 'InvalidVerificationTokenError';
        throw err;
    }

    const decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: ['HS256'],
        audience: STAFF_VERIFICATION_PURPOSE,
    });

    if (
        !decoded ||
        typeof decoded !== 'object' ||
        'id' in decoded ||
        'role' in decoded ||
        decoded.purpose !== STAFF_VERIFICATION_PURPOSE ||
        !decoded.jti ||
        !decoded.branchId ||
        !decoded.staffId
    ) {
        const err = new Error('Invalid verification token claims');
        err.name = 'InvalidVerificationTokenError';
        throw err;
    }

    return decoded;
}
