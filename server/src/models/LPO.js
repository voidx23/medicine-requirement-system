import mongoose from 'mongoose';

const lpoSchema = new mongoose.Schema({
    lpoNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true,
        index: true
    },
    divisionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SupplierDivision',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    deliveryDate: {
        type: Date
    },
    paymentTerms: {
        type: String,
        default: '30 Days'
    },
    remarks: {
        type: String,
        default: ''
    },
    preparedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['draft', 'pending_approval', 'approved', 'sent', 'ordered', 'partially_received', 'received', 'cancelled'],
        default: 'draft',
        index: true
    },
    erpPoId: {
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
    totalAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const LPO = mongoose.model('LPO', lpoSchema);

export default LPO;
