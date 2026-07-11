import mongoose from 'mongoose';

const supplierDivisionSchema = new mongoose.Schema({
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true,
        index: true
    },
    divisionName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    erpId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    erpSyncStatus: {
        type: String,
        enum: ['pending', 'synced', 'failed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Compound unique index so a division name cannot be duplicated per supplier
supplierDivisionSchema.index({ supplierId: 1, divisionName: 1 }, { unique: true });

const SupplierDivision = mongoose.model('SupplierDivision', supplierDivisionSchema);

export default SupplierDivision;
