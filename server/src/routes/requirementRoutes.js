import express from 'express';
import { getTodayRequirement, addItem, removeItem, generatePDF, getHistory, deleteHistory, getReportData, getMedicineAudit, toggleUrgent } from '../controllers/requirementController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/history', requirePermission('view_order_history'), getHistory);
router.get('/today', requirePermission('view_requirements'), getTodayRequirement);
router.post('/add-item', requirePermission('add_requirement_item'), addItem);
router.delete('/item/:medicineId', requirePermission('remove_requirement_item'), removeItem);
router.post('/generate-pdf', requirePermission('generate_requirement_pdf'), generatePDF);
router.post('/report-data', requirePermission('view_reports_dashboard'), getReportData); 
router.delete('/history/:id', requirePermission('delete_order_history'), deleteHistory);
router.get('/medicine-audit', requirePermission('view_medicine_audit_logs'), getMedicineAudit);
router.patch('/item/:medicineId/urgent', requirePermission('toggle_requirement_urgency'), toggleUrgent);

export default router;
