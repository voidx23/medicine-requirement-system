import mongoose from 'mongoose';

const purchaseHistorySchema = new mongoose.Schema({
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
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true,
        index: true
    },
    invoiceNumber: {
        type: String,
        required: true,
        index: true
    },
    invoiceDate: {
        type: Date,
        required: true,
        index: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    foc: {
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
    },
    erpInvoiceId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    }
}, {
    timestamps: true
});

const PurchaseHistory = mongoose.model('PurchaseHistory', purchaseHistorySchema);

export default PurchaseHistory;
