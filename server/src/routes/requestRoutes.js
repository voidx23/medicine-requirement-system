import express from 'express';
import { submitRequest, getRequests, updateRequestStatus, getStats } from '../controllers/requestController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here are protected
router.use(protect);

// Put stats route BEFORE parameterized routes to avoid conflict (though none here yet, good practice)
router.get('/stats', getStats);
router.post('/submit', submitRequest);
router.get('/', getRequests);
router.put('/:id/status', admin, updateRequestStatus);

export default router;
