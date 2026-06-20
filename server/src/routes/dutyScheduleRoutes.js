import express from 'express';
import { getDutySchedules, saveDutySchedule } from '../controllers/dutyScheduleController.js';
import { protect, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getDutySchedules);

router.route('/save')
    .post(protect, superAdmin, saveDutySchedule);

export default router;
