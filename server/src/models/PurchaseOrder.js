import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    quantityOrdered: {
        type: Number,
        required: true,
        min: 1
    },
    quantityReceived: {
        type: Number,
        default: 0
    },
    costPrice: {
        type: Number,
        required: true,
        default: 0
    }
});

const purchaseOrderSchema = new mongoose.Schema({
    poNumber: {
        type: String,
        required: true,
        unique: true
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'ordered', 'partially_received', 'received', 'cancelled'],
        default: 'draft'
    },
    items: [purchaseOrderItemSchema],
    totalAmount: {
        type: Number,
        default: 0
    },
    notes: {
        type: String,
        default: ''
    },
    orderedAt: {
        type: Date
    },
    receivedAt: {
        type: Date
    }
}, {
    timestamps: true
});

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
