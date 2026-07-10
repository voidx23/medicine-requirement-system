import express from 'express';
import { 
    createPurchaseOrder, 
    getPurchaseOrders, 
    getPurchaseOrderById, 
    updatePurchaseOrder, 
    receivePurchaseOrder, 
    suggestPOFromRequirements 
} from '../controllers/purchaseController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('view_purchasing'), getPurchaseOrders);
router.post('/', requirePermission('create_purchase_orders'), createPurchaseOrder);
router.get('/suggestions', requirePermission('create_purchase_orders'), suggestPOFromRequirements);
router.get('/:id', requirePermission('view_purchasing'), getPurchaseOrderById);
router.put('/:id', requirePermission('create_purchase_orders'), updatePurchaseOrder);
router.put('/:id/receive', requirePermission('receive_purchase_orders'), receivePurchaseOrder);

export default router;
