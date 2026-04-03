import express from 'express';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getSuppliers)
    .post(protect, requirePermission('edit_suppliers'), addSupplier);

router.route('/:id')
    .put(protect, requirePermission('edit_suppliers'), updateSupplier)
    .delete(protect, requirePermission('edit_suppliers'), deleteSupplier);

export default router;
