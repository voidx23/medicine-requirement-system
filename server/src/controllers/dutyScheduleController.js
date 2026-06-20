import DutySchedule from '../models/DutySchedule.js';

// @desc    Get duty schedules for a given month and year
// @route   GET /api/duty-schedules
// @access  Private (Admin)
export const getDutySchedules = async (req, res) => {
  try {
    const { year, month } = req.query;
    if (year === undefined || month === undefined) {
      return res.status(400).json({ message: 'Year and month are required' });
    }

    const schedules = await DutySchedule.find({
      year: parseInt(year),
      month: parseInt(month)
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching duty schedules:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Save (create or update) duty schedule for a branch, month, year
// @route   POST /api/duty-schedules/save
// @access  Private (Admin)
export const saveDutySchedule = async (req, res) => {
  try {
    const { branchId, year, month, shifts, remarks, notes } = req.body;

    if (!branchId || year === undefined || month === undefined) {
      return res.status(400).json({ message: 'Branch ID, year, and month are required' });
    }

    const schedule = await DutySchedule.findOneAndUpdate(
      { branchId, year, month },
      {
        shifts,
        remarks,
        notes
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'Schedule saved successfully', schedule });
  } catch (error) {
    console.error('Error saving duty schedule:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
