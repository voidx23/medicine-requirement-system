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
    deleteExpiryReturn,
    updateExpiryReturn,
    deleteSupplierLedger,
    markItemAsNonReturnable,
    getLedgerDetails
} from '../controllers/expiryController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Pharmacist Routes
router.route('/').post(protect, createExpiryReturn);
router.route('/my-returns').get(protect, getMyExpiryReturns);

// Admin / Store Routes
router.route('/all').get(protect, requirePermission('expiry_returns'), getAllExpiryReturns);
router.route('/pending-count').get(protect, getPendingExpiryCount);
router.route('/:id/verify').put(protect, requirePermission('expiry_returns'), verifyExpiryReturn);
router.route('/:id/items/:itemId/dispose').put(protect, requirePermission('expiry_returns'), markItemAsNonReturnable);
router.route('/:id').delete(protect, requirePermission('expiry_returns'), deleteExpiryReturn);
router.route('/:id').put(protect, requirePermission('expiry_returns'), updateExpiryReturn);

// Handover Routes
router.route('/handover-pending').get(protect, requirePermission('expiry_returns'), getPendingHandoverItems);
router.route('/handover').post(protect, requirePermission('expiry_returns'), processHandover);

// Supplier Ledger Routes
router.route('/ledgers').get(protect, requirePermission('expiry_returns'), getSupplierLedgers);
router.route('/ledgers/:id/details').get(protect, requirePermission('expiry_returns'), getLedgerDetails);
router.route('/ledgers/:id/compensate').post(protect, requirePermission('expiry_returns'), logCompensation);
router.route('/ledgers/:id').delete(protect, requirePermission('expiry_returns'), deleteSupplierLedger);

export default router;
