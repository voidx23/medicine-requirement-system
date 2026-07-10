import express from 'express';
import { getBranches, getBranchById, createBranch, updateBranch, deleteBranch } from '../controllers/branchController.js';
import { protect, superAdmin, admin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getBranches)
    .post(protect, requirePermission('create_branches'), createBranch);

router.route('/:id')
    .get(protect, getBranchById)
    .put(protect, requirePermission('edit_branches'), updateBranch)
    .delete(protect, requirePermission('delete_branches'), deleteBranch);

export default router;
