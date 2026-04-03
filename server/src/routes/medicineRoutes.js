import express from 'express';
import { getMedicines, addMedicine, updateMedicine, deleteMedicine } from '../controllers/medicineController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getMedicines)
    .post(protect, requirePermission('edit_medicines'), addMedicine);

router.route('/:id')
    .put(protect, requirePermission('edit_medicines'), updateMedicine)
    .delete(protect, requirePermission('edit_medicines'), deleteMedicine);

export default router;
