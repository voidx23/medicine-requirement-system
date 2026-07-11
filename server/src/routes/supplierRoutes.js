import express from 'express';
import { 
    getSuppliers, 
    addSupplier, 
    updateSupplier, 
    deleteSupplier,
    getDivisions,
    addDivision,
    updateDivision,
    deleteDivision
} from '../controllers/supplierController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Supplier Master routes
router.route('/')
    .get(protect, getSuppliers)
    .post(protect, requirePermission('edit_suppliers'), addSupplier);

router.route('/:id')
    .put(protect, requirePermission('edit_suppliers'), updateSupplier)
    .delete(protect, requirePermission('edit_suppliers'), deleteSupplier);

// Supplier Divisions routes nested under supplier
router.route('/:supplierId/divisions')
    .get(protect, getDivisions)
    .post(protect, requirePermission('edit_suppliers'), addDivision);

router.route('/:supplierId/divisions/:id')
    .put(protect, requirePermission('edit_suppliers'), updateDivision)
    .delete(protect, requirePermission('edit_suppliers'), deleteDivision);

export default router;
