import mongoose from 'mongoose';

const usedVerificationTokenSchema = new mongoose.Schema({
    jti: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    purpose: {
        type: String,
        required: true
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Branch'
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Staff'
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

usedVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UsedVerificationToken = mongoose.model('UsedVerificationToken', usedVerificationTokenSchema);

export default UsedVerificationToken;
