import User from '../models/User.js';
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

    const user = await User.findOne({ username });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            username: user.username,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid username or password' });
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
