import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    crNo: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        default: ''
    },
    contact: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    supplierType: {
        type: String,
        enum: ['exclusive', 'multi'],
        default: 'exclusive'
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
    },
    erpSyncError: {
        type: String
    }
}, {
    timestamps: true 
});

// Middleware to keep status and legacy isActive in sync
supplierSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.isActive = this.status === 'active';
    } else if (this.isModified('isActive')) {
        this.status = this.isActive ? 'active' : 'inactive';
    }
    next();
});

const Supplier = mongoose.model('Supplier', supplierSchema);

export default Supplier;
