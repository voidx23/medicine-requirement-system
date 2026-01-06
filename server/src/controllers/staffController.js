import Staff from '../models/Staff.js';
import User from '../models/User.js';

// @desc    Get all staff for the logged-in branch (or all if admin)
// @route   GET /api/staff
// @access  Private
const getStaff = async (req, res) => {
    try {
        let query = { isActive: true };
        
        // If it's a pharmacist, only show their own staff
        if (req.user.role === 'pharmacist') {
            query.branchId = req.user._id;
        }
        
        // If specific branch requested (Admin view)
        if (req.query.branchId) {
            query.branchId = req.query.branchId;
        }

        const staff = await Staff.find(query).sort({ name: 1 });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Register a new staff member
// @route   POST /api/staff
// @access  Private (Admin only ideally, but we'll allow flexible for now)
const addStaff = async (req, res) => {
    const { name, pin, branchId } = req.body;

    try {
        // If pharmacist is adding, force branchId to be themselves
        const targetBranchId = req.user.role === 'pharmacist' ? req.user._id : branchId;

        if (!targetBranchId) {
            return res.status(400).json({ message: 'Branch ID is required' });
        }

        const staff = await Staff.create({
            name,
            pin,
            branchId: targetBranchId
        });

        res.status(201).json({
            _id: staff._id,
            name: staff.name,
            branchId: staff.branchId
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Verify PIN for a staff member during request submission
// @route   POST /api/staff/verify
// @access  Private
const verifyStaffPin = async (req, res) => {
    const { staffId, pin } = req.body;

    try {
        const staff = await Staff.findById(staffId);

        if (staff && (await staff.matchPin(pin))) {
            res.json({
                verified: true,
                staffId: staff._id,
                name: staff.name
            });
        } else {
            res.status(401).json({ message: 'Invalid PIN' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete (soft delete/deactivate) staff
// @route   DELETE /api/staff/:id
// @access  Private (Admin)
const deleteStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);

        if (staff) {
            await Staff.deleteOne({ _id: req.params.id }); 
            // Or use soft delete: staff.isActive = false; await staff.save();
            res.json({ message: 'Staff removed' });
        } else {
            res.status(404).json({ message: 'Staff not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all branches (Pharmacist users)
// @route   GET /api/staff/branches
// @access  Private (Admin)
const getBranches = async (req, res) => {
    try {
        const branches = await User.find({ role: 'pharmacist' }).select('-password').sort({ username: 1 });
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export { getStaff, addStaff, verifyStaffPin, deleteStaff, getBranches };
