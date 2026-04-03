import express from 'express';
import { protect, admin, superAdmin } from '../middleware/authMiddleware.js';
import { getStaff, addStaff, updateStaff, verifyStaffPin, deleteStaff, getBranches, assignStaffToBranch, removeStaffFromBranch } from '../controllers/staffController.js';

const router = express.Router();

router.get('/branches', protect, getBranches);

router.route('/')
    .get(protect, getStaff)
    .post(protect, superAdmin, addStaff);

router.post('/verify', protect, verifyStaffPin);

router.route('/:id')
    .put(protect, superAdmin, updateStaff)
    .delete(protect, superAdmin, deleteStaff);

router.put('/:id/branch', protect, superAdmin, assignStaffToBranch);
router.delete('/:id/branch/:branchId', protect, superAdmin, removeStaffFromBranch);

export default router;
