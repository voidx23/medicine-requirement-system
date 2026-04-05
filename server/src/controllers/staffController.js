import Staff from '../models/Staff.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';

// @desc    Get all staff for the logged-in branch (or all if admin)
// @route   GET /api/staff
// @access  Private
const getStaff = async (req, res) => {
    try {
        let query = { isActive: true };
        
        // If it's a branch, only show their own staff
        if (req.user.role === 'branch') {
            query.branches = req.user._id;
        }
        
        // If specific branch requested (Admin view)
        if (req.query.branchId) {
            query.branches = req.query.branchId;
        }

        const staff = await Staff.find(query).sort({ name: 1 }).populate('branches', 'name');
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Register a new staff member
// @route   POST /api/staff
// @access  Private (Admin only ideally, but we'll allow flexible for now)
const addStaff = async (req, res) => {
    const { name, pin } = req.body;

    try {
        const staff = await Staff.create({
            name,
            pin,
            branches: [] // Start with empty branches
        });

        res.status(201).json({
            _id: staff._id,
            name: staff.name,
            branches: staff.branches
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update a staff member's name and PIN
// @route   PUT /api/staff/:id
// @access  Private (Admin)
const updateStaff = async (req, res) => {
    const { name, pin } = req.body;

    try {
        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        if (name) staff.name = name;
        if (pin) staff.pin = pin;

        await staff.save();

        res.json({
            _id: staff._id,
            name: staff.name,
            branches: staff.branches
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Assign a branch to a staff member
// @route   PUT /api/staff/:id/branch
// @access  Private (Admin)
const assignStaffToBranch = async (req, res) => {
    const { branchId } = req.body;
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }
        if (!staff.branches.includes(branchId)) {
            staff.branches.push(branchId);
            await staff.save();
        }
        // Return full staff with branches populated
        const updatedStaff = await Staff.findById(staff._id).populate('branches', 'username');
        res.json(updatedStaff);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Remove a branch from a staff member
// @route   DELETE /api/staff/:id/branch/:branchId
// @access  Private (Admin)
const removeStaffFromBranch = async (req, res) => {
    const { branchId } = req.params;
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }
        staff.branches = staff.branches.filter(b => b.toString() !== branchId);
        await staff.save();
        
        const updatedStaff = await Staff.findById(staff._id).populate('branches', 'username');
        res.json(updatedStaff);
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

// @desc    Get all branches
// @route   GET /api/staff/branches
// @access  Private
const getBranches = async (req, res) => {
    try {
        const branches = await Branch.find({}).select('-password').sort({ name: 1 });
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export { getStaff, addStaff, updateStaff, verifyStaffPin, deleteStaff, getBranches, assignStaffToBranch, removeStaffFromBranch };
