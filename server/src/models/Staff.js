import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    pin: {
        type: String,
        required: true
    },
    branches: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Method to check PIN
staffSchema.methods.matchPin = async function (enteredPin) {
    return await bcrypt.compare(enteredPin, this.pin);
};

// Pre-save middleware to hash PIN
staffSchema.pre('save', async function (next) {
    if (!this.isModified('pin')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
});

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
