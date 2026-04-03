import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_dev_only');

            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};

export const superAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin' && req.user.isSuperAdmin) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a super admin' });
    }
};

export const requirePermission = (permission) => {
    return (req, res, next) => {
        if (req.user && req.user.role === 'admin' && req.user.isSuperAdmin) {
            return next();
        }
        if (req.user && req.user.role === 'admin' && req.user.permissions && req.user.permissions.includes(permission)) {
            return next();
        }
        res.status(403).json({ message: `Forbidden: Requires ${permission} permission` });
    };
};
