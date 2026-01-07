import mongoose from 'mongoose';

const requestSchema = mongoose.Schema({
    pharmacistId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
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
            default: 'pending' 
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'partially_fulfilled', 'completed'],
        default: 'pending'
    },
    adminNotes: {
        type: String
    }
}, {
    timestamps: true
});

const PharmacistRequest = mongoose.model('PharmacistRequest', requestSchema);

export default PharmacistRequest;
