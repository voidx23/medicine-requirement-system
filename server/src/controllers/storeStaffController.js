import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// @desc    Get all store staff
// @route   GET /api/store-staff
// @access  Private (Super Admin)
export const getStoreStaff = async (req, res) => {
    try {
        const staff = await User.find({ role: 'admin', isSuperAdmin: false }).select('-password');
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create a store staff account
// @route   POST /api/store-staff
// @access  Private (Super Admin)
export const createStoreStaff = async (req, res) => {
    const { username, password, permissions } = req.body;

    try {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const user = await User.create({
            username,
            password: password || 'admin123',
            role: 'admin',
            isSuperAdmin: false,
            permissions: permissions || []
        });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            permissions: user.permissions
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update store staff account (permissions, password, username)
// @route   PUT /api/store-staff/:id
// @access  Private (Super Admin)
export const updateStoreStaff = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'admin' || user.isSuperAdmin) {
            return res.status(404).json({ message: 'Store staff not found or cannot edit Super Admin' });
        }

        user.username = req.body.username || user.username;
        if (req.body.permissions) {
            user.permissions = req.body.permissions;
        }
        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            permissions: updatedUser.permissions
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete store staff account
// @route   DELETE /api/store-staff/:id
// @access  Private (Super Admin)
export const deleteStoreStaff = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'admin' || user.isSuperAdmin) {
            return res.status(404).json({ message: 'Store staff not found or cannot delete Super Admin' });
        }

        await user.deleteOne();
        res.json({ message: 'Store staff removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
