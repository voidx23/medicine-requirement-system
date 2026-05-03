import mongoose from 'mongoose';

const compensationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Physical', 'Financial'], // Physical (items replaced), Financial (credit note)
        required: true
    },
    value: {
        type: Number, // OMR value credited
        required: true
    },
    note: {
        type: String,
        default: ''
    },
    dateLogged: {
        type: Date,
        default: Date.now
    }
});

const supplierExpiryLedgerSchema = new mongoose.Schema({
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
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
    totalValueHandedOver: {
        type: Number,
        default: 0
    },
    totalValueCompensated: {
        type: Number,
        default: 0
    },
    compensations: [compensationSchema]
}, { timestamps: true });

// Compound index to ensure uniqueness per supplier per month/year
supplierExpiryLedgerSchema.index({ supplierId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model('SupplierExpiryLedger', supplierExpiryLedgerSchema);
