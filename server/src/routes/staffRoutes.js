import express from 'express';
import { protect, admin, superAdmin, requirePermission } from '../middleware/authMiddleware.js';
import verifyPinRateLimiter from '../middleware/verifyPinRateLimiter.js';
import { getStaff, addStaff, updateStaff, verifyStaffPin, deleteStaff, getBranches, assignStaffToBranch, removeStaffFromBranch } from '../controllers/staffController.js';

const router = express.Router();

router.get('/branches', protect, requirePermission('view_branches'), getBranches);

router.route('/')
    .get(protect, getStaff)
    .post(protect, requirePermission('create_pharmacist_accounts'), addStaff);

router.post('/verify', protect, verifyPinRateLimiter, verifyStaffPin);

router.route('/:id')
    .put(protect, requirePermission('edit_pharmacist_accounts'), updateStaff)
    .delete(protect, requirePermission('delete_pharmacist_accounts'), deleteStaff);

router.put('/:id/branch', protect, requirePermission('assign_pharmacists_to_branches'), assignStaffToBranch);
router.delete('/:id/branch/:branchId', protect, requirePermission('assign_pharmacists_to_branches'), removeStaffFromBranch);

export default router;
