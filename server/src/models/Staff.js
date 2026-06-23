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
        ref: 'Branch'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    designation: {
        type: String,
        default: 'General Pharma'
    },
    rating: {
        type: Number,
        default: 5.0
    },
    profilePicture: {
        type: String,
        default: ''
    },
    licenseNumber: {
        type: String,
        default: ''
    },
    licenseExpiry: {
        type: Date
    },
    licenseNotifyDays: {
        type: Number,
        default: 30
    },
    passportNumber: {
        type: String,
        default: ''
    },
    passportExpiry: {
        type: Date
    },
    passportNotifyDays: {
        type: Number,
        default: 30
    },
    idCardNumber: {
        type: String,
        default: ''
    },
    idCardExpiry: {
        type: Date
    },
    idCardNotifyDays: {
        type: Number,
        default: 30
    },
    remarks: {
        type: String,
        default: ''
    },
    defaultBranch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    },
    defaultShiftType: {
        type: String,
        default: ''
    },
    defaultFromTime: {
        type: String,
        default: ''
    },
    defaultToTime: {
        type: String,
        default: ''
    },
    defaultOffDay: {
        type: String,
        default: ''
    },
    employeeId: {
        type: String,
        default: ''
    },
    joiningDate: {
        type: Date
    },
    employmentType: {
        type: String,
        enum: ['Full Time', 'Part Time', 'Temporary', 'Relief Pharmacist'],
        default: 'Full Time'
    },
    status: {
        type: String,
        enum: ['Active', 'On Leave', 'Suspended', 'Resigned'],
        default: 'Active'
    },
    performanceIssues: [{
        issueType: {
            type: String,
            required: true,
            default: 'General'
        },
        severity: {
            type: String,
            enum: ['Low', 'Medium', 'High'],
            default: 'Medium'
        },
        date: {
            type: Date,
            default: Date.now
        },
        description: {
            type: String,
            required: true
        }
    }]
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
