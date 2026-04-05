import User from '../models/User.js';
import Branch from '../models/Branch.js';
import jwt from 'jsonwebtoken';

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_dev_only', {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res) => {
    const { username, password } = req.body;

    // Check Branch collection first (branches log in by name)
    const branch = await Branch.findOne({ name: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (branch && (await branch.matchPassword(password))) {
        return res.json({
            _id: branch._id,
            username: branch.name,
            role: 'branch',
            isSuperAdmin: false,
            permissions: [],
            location: branch.location,
            contactNumber: branch.contactNumber,
            token: jwt.sign({ id: branch._id, role: 'branch' }, process.env.JWT_SECRET || 'fallback_secret_dev_only', { expiresIn: '30d' }),
        });
    }

    // Then check User collection (admins / store staff)
    const user = await User.findOne({ username });
    if (user && (await user.matchPassword(password))) {
        return res.json({
            _id: user._id,
            username: user.username,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
            permissions: user.permissions,
            token: jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret_dev_only', { expiresIn: '30d' }),
        });
    }

    res.status(401).json({ message: 'Invalid username or password' });
};

// @desc    Verify admin password
// @route   POST /api/auth/verify-password
// @access  Private (Admin)
export const verifyPassword = async (req, res) => {
    const { password } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (user && (await user.matchPassword(password))) {
        res.json({ isValid: true });
    } else {
        res.status(401).json({ isValid: false, message: 'Invalid Admin Password' });
    }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (Should be Admin only in future)
export const registerUser = async (req, res) => {
    const { username, password, role, location, contactNumber } = req.body;

    const userExists = await User.findOne({ username });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
        username,
        password,
        role: role || 'pharmacist',
        location,
        contactNumber
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            username: user.username,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
            permissions: user.permissions,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};
// @desc    Update user details (Admin)
// @route   PUT /api/auth/users/:id
// @access  Private (Admin)
export const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.username = req.body.username || user.username;
            user.location = req.body.location || user.location;
            user.contactNumber = req.body.contactNumber || user.contactNumber;
            
            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                role: updatedUser.role,
                isSuperAdmin: updatedUser.isSuperAdmin,
                permissions: updatedUser.permissions,
                location: updatedUser.location,
                contactNumber: updatedUser.contactNumber
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a user/branch (Super Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private (Super Admin)
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting yourself
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        // Prevent deleting another super admin
        if (user.isSuperAdmin) {
            return res.status(400).json({ message: 'Cannot delete a super admin account' });
        }

        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
