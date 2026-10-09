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
            ref: 'Medicine'
        },
        code: { type: String, default: '' },
        product: { type: String, default: '' },
        batch: { type: String, default: '' },
        expDate: { type: Date },
        expDateFormatted: { type: String, default: '' },
        pack: { type: Number, default: 0 },
        loose: { type: Number, default: 0 },
        unit: { type: String, default: 'BOX' },
        parsedMultiplier: { type: Number, default: 1 },
        price: { type: Number, default: 0 },
        foc: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
        rpSale: { type: Number, default: 0 },
        discAmt: { type: Number, default: 0 },
        netValue: { type: Number, default: 0 },
        vatAmt: { type: Number, default: 0 },
        netAmount: { type: Number, default: 0 },
        quantity: { type: Number, default: 1 },
        focQuantity: { type: Number, default: 0 },
        unitCost: { type: Number, default: 0 },
        totalCost: { type: Number, default: 0 },
        totalUnitsReceived: { type: Number, default: 0 }
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
