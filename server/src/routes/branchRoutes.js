import express from 'express';
import { getBranches, getBranchById, createBranch, updateBranch, deleteBranch } from '../controllers/branchController.js';
import { protect, requirePermission, requireAnyPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, requireAnyPermission(['view_branches', 'view_pharmacists', 'view_duty_schedules', 'view_requests']), getBranches)
    .post(protect, requirePermission('create_branches'), createBranch);

router.route('/:id')
    .get(protect, getBranchById)
    .put(protect, requirePermission('edit_branches'), updateBranch)
    .delete(protect, requirePermission('delete_branches'), deleteBranch);

export default router;
