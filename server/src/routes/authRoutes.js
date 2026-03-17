import express from 'express';
import { authUser, registerUser, updateUser, verifyPassword } from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.post('/verify-password', protect, admin, verifyPassword);
router.post('/register', protect, admin, registerUser);
router.put('/users/:id', protect, admin, updateUser);

export default router;
