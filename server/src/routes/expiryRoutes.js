import express from 'express';
import { 
    createExpiryReturn, 
    getMyExpiryReturns, 
    getAllExpiryReturns, 
    verifyExpiryReturn,
    getSupplierLedgers,
    logCompensation,
    getPendingExpiryCount,
    getPendingHandoverItems,
    processHandover,
    deleteExpiryReturn
} from '../controllers/expiryController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Pharmacist Routes
router.route('/').post(protect, createExpiryReturn);
router.route('/my-returns').get(protect, getMyExpiryReturns);

// Admin / Store Routes
router.route('/all').get(protect, requirePermission('view_tasks'), getAllExpiryReturns);
router.route('/pending-count').get(protect, getPendingExpiryCount);
router.route('/:id/verify').put(protect, requirePermission('edit_tasks'), verifyExpiryReturn);
router.route('/:id').delete(protect, requirePermission('edit_tasks'), deleteExpiryReturn);

// Handover Routes
router.route('/handover-pending').get(protect, requirePermission('view_tasks'), getPendingHandoverItems);
router.route('/handover').post(protect, requirePermission('edit_tasks'), processHandover);

// Supplier Ledger Routes
router.route('/ledgers').get(protect, requirePermission('view_tasks'), getSupplierLedgers);
router.route('/ledgers/:id/compensate').post(protect, requirePermission('edit_tasks'), logCompensation);

export default router;
