import express from 'express';
import { submitRequest, getRequests, updateRequestStatus, getStats, deleteRequest, updateItemStatus, fulfillRequest, resetRequest, forwardItems, getMyPendingMedicines } from '../controllers/requestController.js';
import { protect, admin, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here are protected
router.use(protect);

// Put stats route BEFORE parameterized routes to avoid conflict (though none here yet, good practice)
router.get('/my-pending-medicines', getMyPendingMedicines);
router.get('/stats', getStats);
router.post('/submit', submitRequest);
router.get('/', getRequests);
router.put('/:id/status', admin, updateRequestStatus);
router.put('/:id/items/:itemId/status', admin, updateItemStatus);
router.put('/:id/fulfill', admin, fulfillRequest);
router.put('/:id/reset', admin, resetRequest);
router.delete('/:id', protect, superAdmin, deleteRequest);
router.post('/:id/forward', forwardItems);

export default router;
