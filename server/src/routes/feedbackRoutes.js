import express from 'express';
import { submitFeedback, getAllFeedback } from '../../controllers/feedbackController.js';
import { protect, admin } from '../../middleware/authMiddleware.js'; // Assuming auth middleware is exported as named exports

const router = express.Router();

// POST /api/feedback - Submit feedback (Any authenticated user)
router.post('/', protect, submitFeedback);

// GET /api/feedback - View all feedback (Admin only)
router.get('/', protect, admin, getAllFeedback);

export default router;
