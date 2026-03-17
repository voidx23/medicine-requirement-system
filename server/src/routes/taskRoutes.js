
import express from 'express';
import { 
    createTask, 
    getAdminTasks, 
    getPharmacyTasks, 
    updateTaskStatus,
    updateTask,
    deleteTask,
    respondToTransfer,
} from '../controllers/taskController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Pharmacy Routes ───────────────────────────────────────────────────────────
router.get('/pharmacy', protect, getPharmacyTasks);
router.put('/:taskId/status', protect, updateTaskStatus);
router.put('/:taskId/transfer-respond', protect, respondToTransfer);

// ── Admin Routes ──────────────────────────────────────────────────────────────
// createTask is protect (not admin) — controller enforces role per type
router.route('/')
    .post(protect, createTask)
    .get(protect, admin, getAdminTasks);

router.route('/:id')
    .put(protect, admin, updateTask)
    .delete(protect, admin, deleteTask);

export default router;
