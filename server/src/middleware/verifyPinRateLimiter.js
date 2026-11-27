const attemptsStore = new Map();

/**
 * Creates a fixed-window in-memory rate limiter for POST /api/staff/verify.
 * Note: Per-instance memory store limits brute-force PIN guessing on each API node.
 */
export function createVerifyPinRateLimiter({
    windowMs = 5 * 60 * 1000,
    maxAttempts = 15,
    maxKeys = 500,
} = {}) {
    return (req, res, next) => {
        const now = Date.now();
        const actorKey = req.user?._id ? String(req.user._id) : (req.ip || 'anonymous');
        const targetStaff = typeof req.body?.staffId === 'string' && req.body.staffId.trim()
            ? req.body.staffId.trim()
            : 'unknown';
        const bucketKey = `${actorKey}:${targetStaff}`;

        if (attemptsStore.size > maxKeys) {
            for (const [key, entry] of attemptsStore.entries()) {
                if (now >= entry.resetAt) {
                    attemptsStore.delete(key);
                }
            }
        }

        const existing = attemptsStore.get(bucketKey);
        if (!existing || now >= existing.resetAt) {
            attemptsStore.set(bucketKey, { count: 1, resetAt: now + windowMs });
            return next();
        }

        if (existing.count >= maxAttempts) {
            const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({
                message: 'Too many PIN verification attempts. Please wait a few minutes and try again.',
            });
        }

        existing.count += 1;
        return next();
    };
}

export function resetVerifyPinRateLimiter() {
    attemptsStore.clear();
}

const verifyPinRateLimiter = createVerifyPinRateLimiter();

export default verifyPinRateLimiter;
