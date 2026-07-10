import express from 'express';
import { getDutySchedules, saveDutySchedule } from '../controllers/dutyScheduleController.js';
import { protect, superAdmin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getDutySchedules);

router.route('/save')
    .post(protect, requirePermission('edit_duty_schedules'), saveDutySchedule);

export default router;
