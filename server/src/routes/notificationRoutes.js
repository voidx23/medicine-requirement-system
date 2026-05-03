import express from 'express';
import { 
    getMyNotifications, 
    markAsRead, 
    markAllAsRead 
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getMyNotifications);

router.route('/read-all')
    .put(protect, markAllAsRead);

router.route('/:id/read')
    .put(protect, markAsRead);

export default router;
