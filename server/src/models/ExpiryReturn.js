import mongoose from 'mongoose';

const expiryItemSchema = new mongoose.Schema({
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    qtySent: {
        type: Number,
        required: true,
        min: 1
    },
    qtyReceived: {
        type: Number,
        default: null // Null means store hasn't verified it yet
    },
    costPriceAtReturn: {
        type: Number,
        default: 0 // Snapshot taken when verified
    },
    isNonReturnable: {
        type: Boolean,
        default: false // Store can mark as true (disposed)
    }
});

const expiryReturnSchema = new mongoose.Schema({
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        required: true
    },
    month: {
        type: Number,
        required: true // 1-12
    },
    year: {
        type: Number,
        required: true // e.g. 2026
    },
    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'Verified'],
        default: 'Draft'
    },
    storeNote: {
        type: String,
        default: ''
    },
    items: [expiryItemSchema],
    submittedAt: {
        type: Date
    },
    verifiedAt: {
        type: Date
    }
}, { timestamps: true });

export default mongoose.model('ExpiryReturn', expiryReturnSchema);
