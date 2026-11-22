import express from 'express';
import {
    getOverviewAnalytics,
    getReorderAndTransfers,
    getInventoryAndExpiry,
    getSupplierIntelligence,
    createTransferTaskFromAnalytics
} from '../controllers/analyticsController.js';
import {
    getAnalyticsFilterMeta,
    getProductWiseSales,
    getProductDetailAnalytics,
    getProductBranchTransactions,
    getLocationWiseSales,
    getLocationDetailAnalytics,
    getSalesTransactions,
    getOriginalInvoice
} from '../controllers/salesAnalyticsController.js';
import { protect, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Strictly Super Admin only — exposes chain-wide revenue, margins, costs & payables
router.use(protect, superAdmin);

// Existing 4 Analytics Hub suites + Transfer dispatch
router.get('/overview', getOverviewAnalytics);
router.get('/reorder-transfers', getReorderAndTransfers);
router.get('/inventory-expiry', getInventoryAndExpiry);
router.get('/suppliers', getSupplierIntelligence);
router.post('/transfer-task', createTransferTaskFromAnalytics);

// Advanced Sales Analytics & Invoice-Level Drill-Down (READ COMMITTED)
router.get('/filters/meta', getAnalyticsFilterMeta);
router.get('/products', getProductWiseSales);
router.get('/products/:itemId', getProductDetailAnalytics);
router.get('/products/:itemId/transactions', getProductBranchTransactions);
router.get('/locations', getLocationWiseSales);
router.get('/locations/:locationId', getLocationDetailAnalytics);
router.get('/transactions', getSalesTransactions);
router.get('/invoices/:transactionId', getOriginalInvoice);

export default router;
