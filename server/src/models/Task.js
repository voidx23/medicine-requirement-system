import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
    pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'In Progress', 'Rejected'],
        default: 'Pending',
    },
    completedAt: { type: Date },
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    comment: { type: String },
}, { _id: false });

const transferItemSchema = new mongoose.Schema({
    medicineName:    { type: String, required: true },
    medicineId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    requestedQty:    { type: Number, required: true },
    // Response fields per item
    responseStatus:  { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    responseQty:     { type: Number },
    rejectionReason: { type: String },
}, { _id: true });

const transferDetailsSchema = new mongoose.Schema({
    items: [transferItemSchema],
    donorBranchId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    recipientBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    respondedAt:      { type: Date },
}, { _id: false });

const taskSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['general', 'transfer_request'],
        default: 'general',
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: { type: String },
    priority: {
        type: String,
        enum: ['Low', 'Normal', 'High', 'Urgent'],
        default: 'Normal',
    },
    dueDate: { type: Date },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    targetAudience: {
        type: String,
        enum: ['All', 'Specific'],
        default: 'Specific',
    },
    assignments: [assignmentSchema],

    // Only populated for transfer_request tasks
    transferDetails:  { type: transferDetailsSchema,  default: undefined },
}, { timestamps: true });

export default mongoose.model('Task', taskSchema);
