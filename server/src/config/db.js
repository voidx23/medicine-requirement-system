import mongoose from 'mongoose';
import UsedVerificationToken from '../models/UsedVerificationToken.js';

/**
 * Ensures required indexes exist on UsedVerificationToken before serving HTTP requests.
 * Does not drop indexes, run syncIndexes(), or touch PharmacistRequest indexes.
 */
export const ensureRequiredIndexes = async ({ tokenModel = UsedVerificationToken } = {}) => {
    await tokenModel.createIndexes();

    const indexes = await tokenModel.collection.indexes();
    const jtiIndex = indexes.find((idx) => idx.key?.jti === 1 && idx.unique === true);
    if (!jtiIndex) {
        throw new Error('Required unique { jti: 1 } index is missing on UsedVerificationToken');
    }

    const ttlIndex = indexes.find((idx) => idx.key?.expiresAt === 1 && idx.expireAfterSeconds === 0);
    if (!ttlIndex) {
        throw new Error('Required TTL { expiresAt: 1, expireAfterSeconds: 0 } index is missing on UsedVerificationToken');
    }

    console.log('UsedVerificationToken indexes verified (unique jti, TTL expiresAt)');
    return { jtiIndex, ttlIndex };
};

const connectDB = async ({
    uri = process.env.MONGO_URI,
    mongooseInstance = mongoose,
    tokenModel = UsedVerificationToken,
} = {}) => {
    const conn = await mongooseInstance.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await ensureRequiredIndexes({ tokenModel });
    return conn;
};

export default connectDB;
