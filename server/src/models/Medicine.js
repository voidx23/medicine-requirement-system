import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    barcode: {
        type: String,
        trim: true,
        default: ''
    },
    costPrice: {
        type: Number,
        default: 0
    },
    sellingPrice: {
        type: Number,
        default: 0
    },
    unitsPerBox: {
        type: Number,
        default: 1
    },
    unitVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    divisionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SupplierDivision',
        index: true
    },
    unit: {
        type: String,
        default: 'Box'
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    previouslySuppliedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        index: true
    }]
}, {
    timestamps: true
});

// Middleware to sync status with isActive
medicineSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.isActive = this.status === 'active';
    } else if (this.isModified('isActive')) {
        this.status = this.isActive ? 'active' : 'inactive';
    }
    next();
});

const Medicine = mongoose.model('Medicine', medicineSchema);

export default Medicine;
