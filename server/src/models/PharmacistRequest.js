import mongoose from 'mongoose';

const requestSchema = mongoose.Schema({
    pharmacistId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Branch'
    },
    submittedBy: {
        type: String, // Storing Name directly for historical permanence
        required: true
    },
    items: [{
        medicineId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: false // Allow custom items without ID
        },
        name: { 
            type: String, 
            required: true 
        },
        quantity: {
            type: Number,
            required: true,
            default: 1
        },
        isCustom: {
            type: Boolean,
            default: false
        },
        status: {
            type: String, 
            default: 'pending' // pending, packed, forwarded, skipped
        },
        isUrgent: {
            type: Boolean,
            default: false
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'partially_fulfilled', 'completed', 'unfulfilled'],
        default: 'pending'
    },
    adminNotes: {
        type: String
    },
    forwardingProcessed: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true
});

// Compound indexes to accelerate GET /api/requests filtering and sorting
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ pharmacistId: 1, status: 1, createdAt: -1 });
requestSchema.index({ 'items.status': 1 });

const PharmacistRequest = mongoose.model('PharmacistRequest', requestSchema);

export default PharmacistRequest;
