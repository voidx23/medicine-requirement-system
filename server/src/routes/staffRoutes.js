import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js'; // Assuming auth mware exists
import { getStaff, addStaff, verifyStaffPin, deleteStaff, getBranches } from '../controllers/staffController.js';

const router = express.Router();

router.get('/branches', protect, getBranches);

router.route('/')
    .get(protect, getStaff)
    .post(protect, addStaff);

router.post('/verify', protect, verifyStaffPin);

router.route('/:id')
    .delete(protect, deleteStaff);

export default router;
