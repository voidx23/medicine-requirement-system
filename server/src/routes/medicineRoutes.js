import express from 'express';
import { getMedicines, addMedicine, updateMedicine, deleteMedicine } from '../controllers/medicineController.js';
import { protect, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getMedicines)
    .post(protect, superAdmin, addMedicine);

router.route('/:id')
    .put(protect, superAdmin, updateMedicine)
    .delete(protect, superAdmin, deleteMedicine);

export default router;
