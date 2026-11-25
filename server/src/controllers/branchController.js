import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import PharmacistRequest from '../models/PharmacistRequest.js';
import Task from '../models/Task.js';
import Staff from '../models/Staff.js';
import { signAuthToken } from '../config/jwtConfig.js';
import { hasPermission, hasAnyPermission } from '../middleware/authMiddleware.js';

const BRANCH_DIRECTORY_PERMISSIONS = ['view_branches', 'view_pharmacists', 'view_duty_schedules', 'view_requests'];

const isValidObjectIdString = (value) => (
    typeof value === 'string'
    && /^[0-9a-fA-F]{24}$/.test(value)
    && mongoose.Types.ObjectId.isValid(value)
);

const generateToken = (id, role = 'branch') => {
    return signAuthToken({ id, role });
};

// @desc    Get all branches
// @route   GET /api/branches
// @access  Private (Admin with directory permission)
export const getBranches = async (req, res) => {
    try {
        if (!hasAnyPermission(req.user, BRANCH_DIRECTORY_PERMISSIONS)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions to view branches' });
        }
        const projection = hasPermission(req.user, 'view_branches') ? '-password' : '_id name';
        const branches = await Branch.find({}).select(projection).sort({ name: 1 });
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Private (Admin with view_branches or matching Branch)
export const getBranchById = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        if (!isValidObjectIdString(req.params.id)) {
            return res.status(400).json({ message: 'Invalid branch ID' });
        }
        if (req.user.role === 'branch') {
            if (req.params.id !== String(req.user._id)) {
                return res.status(403).json({ message: 'Forbidden: Cannot access another branch record' });
            }
        } else if (req.user.role === 'admin') {
            if (!hasPermission(req.user, 'view_branches')) {
                return res.status(403).json({ message: 'Forbidden: Requires view_branches permission' });
            }
        } else {
            return res.status(403).json({ message: 'Forbidden: Unauthorized role' });
        }

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

        // ── Safety Check 1: Pending or active requests ──────────────────────────
        const activeRequests = await PharmacistRequest.countDocuments({
            pharmacistId: branch._id,
            status: { $in: ['pending', 'approved', 'partially_fulfilled'] }
        });
        if (activeRequests > 0) {
            return res.status(400).json({
                message: `Cannot delete "${branch.name}": it has ${activeRequests} active request(s) that are still pending or in progress. Resolve them first.`
            });
        }

        // ── Safety Check 2: Open tasks assigned to this branch ──────────────────
        const openTasks = await Task.countDocuments({
            'assignments.pharmacyId': branch._id,
            'assignments.status': { $in: ['Pending', 'In Progress'] }
        });
        if (openTasks > 0) {
            return res.status(400).json({
                message: `Cannot delete "${branch.name}": it has ${openTasks} open task(s) still assigned to it. Complete or reassign them first.`
            });
        }

        // ── Safety Check 3: Staff still assigned to this branch ─────────────────
        const assignedStaff = await Staff.countDocuments({ branches: branch._id });
        if (assignedStaff > 0) {
            return res.status(400).json({
                message: `Cannot delete "${branch.name}": ${assignedStaff} pharmacist(s) are still assigned to it. Remove them first from the Pharmacists page.`
            });
        }

        // All clear — proceed with deletion
        await Branch.deleteOne({ _id: req.params.id });
        res.json({ message: 'Branch deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
