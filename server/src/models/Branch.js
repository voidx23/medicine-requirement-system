import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const branchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    location: { type: String },
    contactNumber: { type: String }
}, {
    timestamps: true
});

// Method to check password
branchSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Pre-save middleware to hash password
branchSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const Branch = mongoose.model('Branch', branchSchema);

export default Branch;
