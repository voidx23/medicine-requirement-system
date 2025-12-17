import express from 'express';
import { getMedicines, addMedicine, updateMedicine, deleteMedicine } from '../controllers/medicineController.js';

const router = express.Router();

router.route('/')
    .get(getMedicines)
    .post(addMedicine);

router.route('/:id')
    .put(updateMedicine)
    .delete(deleteMedicine);

export default router;
