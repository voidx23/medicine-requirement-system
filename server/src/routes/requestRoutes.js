import express from 'express';
import { submitRequest, getRequests, updateRequestStatus, getStats, deleteRequest, updateItemStatus, fulfillRequest, resetRequest, forwardItems, getMyPendingMedicines } from '../controllers/requestController.js';
import { protect, admin, superAdmin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here are protected
router.use(protect);

const allowBranchOrAdminPermission = (permission) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (req.user.role === 'branch') {
        return next();
    }
    if (req.user.role === 'admin') {
        return requirePermission(permission)(req, res, next);
    }
    return res.status(403).json({ message: 'Forbidden: Unauthorized role' });
};

const requireBranch = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (req.user.role !== 'branch') {
        return res.status(403).json({ message: 'Forbidden: Only branch accounts can submit requests' });
    }
    return next();
};

// Put stats route BEFORE parameterized routes to avoid conflict (though none here yet, good practice)
router.get('/my-pending-medicines', getMyPendingMedicines);
router.get('/stats', allowBranchOrAdminPermission('view_requests'), getStats);
router.post('/submit', requireBranch, submitRequest);
router.get('/', (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return requirePermission('view_requests')(req, res, next);
    }
    next();
}, getRequests);
router.put('/:id/status', requirePermission('edit_requests'), updateRequestStatus);
router.put('/:id/items/:itemId/status', requirePermission('fulfill_requests'), updateItemStatus);
router.put('/:id/fulfill', requirePermission('fulfill_requests'), fulfillRequest);
router.put('/:id/reset', requirePermission('edit_requests'), resetRequest);
router.delete('/:id', protect, superAdmin, deleteRequest);
router.post('/:id/forward', allowBranchOrAdminPermission('forward_requests'), forwardItems);

export default router;
