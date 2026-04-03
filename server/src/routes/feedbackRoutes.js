import express from 'express';
import { submitFeedback, getAllFeedback } from '../controllers/feedbackController.js';
import { protect, admin, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/feedback - Submit feedback (Any authenticated user)
router.post('/', protect, submitFeedback);

// GET /api/feedback - View all feedback (Admin only)
router.get('/', protect, superAdmin, getAllFeedback);

export default router;
