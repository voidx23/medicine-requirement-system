import User from '../models/User.js';
import Branch from '../models/Branch.js';
import { signAuthToken } from '../config/jwtConfig.js';

// Generate JWT
const generateToken = (id) => {
    return signAuthToken({ id });
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
            token: signAuthToken({ id: branch._id, role: 'branch' }),
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
            token: signAuthToken({ id: user._id }),
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

// @desc    Register a new admin user (Super Admin only)
// @route   POST /api/auth/register
// @access  Private (Super Admin)
export const registerUser = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin' || req.user.isSuperAdmin !== true) {
            return res.status(403).json({ message: 'Forbidden: Super Admin access required' });
        }

        const { username, password, location, contactNumber } = req.body || {};
        const trimmedUsername = typeof username === 'string' ? username.trim() : '';
        const passwordValue = typeof password === 'string' ? password : '';

        if (!trimmedUsername || !passwordValue.trim()) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const userExists = await User.findOne({ username: trimmedUsername });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            username: trimmedUsername,
            password: passwordValue,
            role: 'admin',
            isSuperAdmin: false,
            permissions: [],
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
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({ message: 'User already exists' });
        }
        if (error?.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};
// @desc    Update user details (Super Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private (Super Admin)
export const updateUser = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin' || req.user.isSuperAdmin !== true) {
            return res.status(403).json({ message: 'Forbidden: Super Admin access required' });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Allow Super Admin self-management, but block modifying another Super Admin account
        if (user.isSuperAdmin && user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Cannot modify another super admin account' });
        }

        const { username, location, contactNumber, password } = req.body || {};

        if (password !== undefined && (typeof password !== 'string' || !password.trim())) {
            return res.status(400).json({ message: 'Password must not be empty or whitespace-only' });
        }

        if (typeof username === 'string' && username.trim()) {
            user.username = username.trim();
        }
        if (location !== undefined) {
            user.location = location;
        }
        if (contactNumber !== undefined) {
            user.contactNumber = contactNumber;
        }
        if (password !== undefined) {
            user.password = password;
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
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        if (error?.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        if (error?.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server Error' });
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
