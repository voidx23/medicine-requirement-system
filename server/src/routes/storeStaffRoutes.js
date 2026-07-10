import express from 'express';
import { protect, superAdmin, requirePermission } from '../middleware/authMiddleware.js';
import { getStoreStaff, createStoreStaff, updateStoreStaff, deleteStoreStaff } from '../controllers/storeStaffController.js';

const router = express.Router();

router.route('/')
    .get(protect, requirePermission('manage_store_staff_permissions'), getStoreStaff)
    .post(protect, requirePermission('manage_store_staff_permissions'), createStoreStaff);

router.route('/:id')
    .put(protect, requirePermission('manage_store_staff_permissions'), updateStoreStaff)
    .delete(protect, requirePermission('manage_store_staff_permissions'), deleteStoreStaff);

export default router;
