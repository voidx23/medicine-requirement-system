import mongoose from 'mongoose';

const purchaseInvoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    invoiceDate: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    lpoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LPO',
        index: true
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true,
        index: true
    },
    items: [{
        medicineId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        focQuantity: {
            type: Number,
            default: 0
        },
        unitCost: {
            type: Number,
            required: true
        },
        totalCost: {
            type: Number,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    invoiceFile: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

const PurchaseInvoice = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);

export default PurchaseInvoice;
