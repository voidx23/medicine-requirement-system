import express from 'express';
import { submitFeedback, getAllFeedback } from '../controllers/feedbackController.js';
import { protect, admin, superAdmin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/feedback - Submit feedback (Any authenticated user)
router.post('/', protect, submitFeedback);

// GET /api/feedback - View all feedback (Admin only)
router.get('/', protect, requirePermission('view_user_feedback'), getAllFeedback);

export default router;
