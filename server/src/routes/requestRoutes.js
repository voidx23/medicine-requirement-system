import express from 'express';
import { submitRequest, getRequests, updateRequestStatus } from '../controllers/requestController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here are protected
router.use(protect);

router.post('/submit', submitRequest);
router.get('/', getRequests);
router.put('/:id/status', admin, updateRequestStatus);

export default router;
