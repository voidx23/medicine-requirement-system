import express from 'express';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController.js';

const router = express.Router();

router.route('/')
    .get(getSuppliers)
    .post(addSupplier);

router.route('/:id')
    .put(updateSupplier)
    .delete(deleteSupplier);

export default router;
