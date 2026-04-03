import express from 'express';
import { protect, superAdmin } from '../middleware/authMiddleware.js';
import { getStoreStaff, createStoreStaff, updateStoreStaff, deleteStoreStaff } from '../controllers/storeStaffController.js';

const router = express.Router();

router.route('/')
    .get(protect, superAdmin, getStoreStaff)
    .post(protect, superAdmin, createStoreStaff);

router.route('/:id')
    .put(protect, superAdmin, updateStoreStaff)
    .delete(protect, superAdmin, deleteStoreStaff);

export default router;
