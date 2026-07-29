import mongoose from 'mongoose';

const supplierMedicineStatsSchema = new mongoose.Schema({
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true,
        index: true
    },
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true,
        index: true
    },
    purchaseCount: {
        type: Number,
        default: 0
    },
    lastOrderedQty: {
        type: Number,
        default: 0
    },
    lastReceivedQty: {
        type: Number,
        default: 0
    },
    lastFocQty: {
        type: Number,
        default: 0
    },
    lastUnitCost: {
        type: Number,
        default: 0
    },
    lastLpoNumber: {
        type: String,
        default: ''
    },
    lastOrderDate: {
        type: Date
    },
    totalOrderedQty: {
        type: Number,
        default: 0
    },
    totalFocQty: {
        type: Number,
        default: 0
    },
    averageFocPercent: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index to guarantee uniqueness and fast lookups
supplierMedicineStatsSchema.index({ supplierId: 1, medicineId: 1 }, { unique: true });

const SupplierMedicineStats = mongoose.model('SupplierMedicineStats', supplierMedicineStatsSchema);

export default SupplierMedicineStats;
