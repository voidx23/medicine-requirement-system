import mongoose from 'mongoose';

const lpoItemSchema = new mongoose.Schema({
    lpoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LPO',
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true,
        index: true
    },
    orderQuantity: {
        type: Number,
        required: true,
        min: 1
    },
    receivedQuantity: {
        type: Number,
        default: 0
    },
    lastPrice: {
        type: Number,
        default: 0
    },
    lastFoc: {
        type: Number,
        default: 0
    },
    remarks: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Ensure that a product is unique within a single LPO
lpoItemSchema.index({ lpoId: 1, productId: 1 }, { unique: true });

const LPOItem = mongoose.model('LPOItem', lpoItemSchema);

export default LPOItem;
