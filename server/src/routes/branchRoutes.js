import express from 'express';
import { getBranches, getBranchById, createBranch, updateBranch, deleteBranch } from '../controllers/branchController.js';
import { protect, superAdmin, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getBranches)
    .post(protect, superAdmin, createBranch);

router.route('/:id')
    .get(protect, getBranchById)
    .put(protect, superAdmin, updateBranch)
    .delete(protect, superAdmin, deleteBranch);

export default router;
