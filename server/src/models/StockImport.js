import mongoose from 'mongoose';

const stockImportSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true,
        index: true
    },
    store: {
        type: String,
        required: true,
        index: true
    },
    currentQuantity: {
        type: Number,
        required: true,
        default: 0
    },
    batch: {
        type: String,
        required: true,
        trim: true
    },
    expiry: {
        type: Date,
        required: true,
        index: true
    },
    importedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

const StockImport = mongoose.model('StockImport', stockImportSchema);

export default StockImport;
