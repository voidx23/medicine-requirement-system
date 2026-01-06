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
            required: true,
            ref: 'Medicine'
        },
        name: String, // Snapshot of name in case medicine is deleted
        quantity: {
            type: Number,
            required: true,
            default: 1
        },
        status: {
            type: String, // 'pending', 'fulfilled', 'rejected' (per item status? or logic uses global?)
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
