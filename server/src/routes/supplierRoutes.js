import express from 'express';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController.js';
import { protect, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getSuppliers)
    .post(protect, superAdmin, addSupplier);

router.route('/:id')
    .put(protect, superAdmin, updateSupplier)
    .delete(protect, superAdmin, deleteSupplier);

export default router;
