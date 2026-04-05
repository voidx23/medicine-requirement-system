import Branch from '../models/Branch.js';
import jwt from 'jsonwebtoken';

const generateToken = (id, role = 'branch') => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret_dev_only', {
        expiresIn: '30d',
    });
};

// @desc    Get all branches
// @route   GET /api/branches
// @access  Private (Admin)
export const getBranches = async (req, res) => {
    try {
        const branches = await Branch.find({}).select('-password').sort({ name: 1 });
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Private
export const getBranchById = async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id).select('-password');
        if (!branch) return res.status(404).json({ message: 'Branch not found' });
        res.json(branch);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a new branch
// @route   POST /api/branches
// @access  Private (Super Admin)
export const createBranch = async (req, res) => {
    try {
        const { name, password, location, contactNumber } = req.body;

        if (!name || !password) {
            return res.status(400).json({ message: 'Name and password are required' });
        }

        const exists = await Branch.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (exists) {
            return res.status(400).json({ message: 'A branch with this name already exists' });
        }

        const branch = await Branch.create({ name, password, location, contactNumber });

        res.status(201).json({
            _id: branch._id,
            name: branch.name,
            location: branch.location,
            contactNumber: branch.contactNumber,
            token: generateToken(branch._id),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update branch details
// @route   PUT /api/branches/:id
// @access  Private (Super Admin)
export const updateBranch = async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) return res.status(404).json({ message: 'Branch not found' });

        branch.name = req.body.name || branch.name;
        branch.location = req.body.location !== undefined ? req.body.location : branch.location;
        branch.contactNumber = req.body.contactNumber !== undefined ? req.body.contactNumber : branch.contactNumber;
        if (req.body.password) {
            branch.password = req.body.password;
        }

        const updated = await branch.save();
        res.json({
            _id: updated._id,
            name: updated.name,
            location: updated.location,
            contactNumber: updated.contactNumber,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a branch
// @route   DELETE /api/branches/:id
// @access  Private (Super Admin)
export const deleteBranch = async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) return res.status(404).json({ message: 'Branch not found' });

        await Branch.deleteOne({ _id: req.params.id });
        res.json({ message: 'Branch deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
