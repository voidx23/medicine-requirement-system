import mongoose from 'mongoose';

const requirementListSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true
    },
    items: [{
        medicineId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        isUrgent: {
            type: Boolean,
            default: false
        }
    }]
}, {
    timestamps: true
});

const RequirementList = mongoose.model('RequirementList', requirementListSchema);

export default RequirementList;
