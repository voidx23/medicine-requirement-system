import mongoose from 'mongoose';

const expiryItemSchema = new mongoose.Schema({
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: false,
        default: null
    },
    customName: {
        type: String,
        default: ''
    },
    qtySent: {
        type: Number,
        required: true,
        min: 1
    },
    qtySentLoose: {
        type: Number,
        default: 0
    },
    qtyReceived: {
        type: Number,
        default: null
    },
    qtyReceivedLoose: {
        type: Number,
        default: null
    },
    costPriceAtReturn: {
        type: Number,
        default: 0
    },
    isNonReturnable: {
        type: Boolean,
        default: false
    },
    handoverStatus: {
        type: String,
        enum: ['Pending', 'HandedOver'],
        default: 'Pending'
    },
    handedOverAt: {
        type: Date,
        default: null
    }
});

const expiryReturnSchema = new mongoose.Schema({
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
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
