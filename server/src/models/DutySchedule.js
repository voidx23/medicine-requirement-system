import mongoose from 'mongoose';

const dutyScheduleSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true // 0-11 for Jan-Dec
  },
  shifts: {
    type: Map,
    of: {
      morning: {
        pharmacistId: { type: String },
        fromTime: { type: String },
        toTime: { type: String }
      },
      evening: {
        pharmacistId: { type: String },
        fromTime: { type: String },
        toTime: { type: String }
      }
    },
    default: {}
  },
  remarks: {
    type: Map,
    of: String,
    default: {}
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index to guarantee uniqueness per branch/year/month
dutyScheduleSchema.index({ branchId: 1, year: 1, month: 1 }, { unique: true });

const DutySchedule = mongoose.model('DutySchedule', dutyScheduleSchema);

export default DutySchedule;

