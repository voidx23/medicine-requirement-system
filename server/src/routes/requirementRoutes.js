import express from 'express';
// Import debugTime (needs to be added to import list above manually first? No, I should update import)
import { getTodayRequirement, addItem, removeItem, generatePDF, getHistory, deleteHistory, getReportData, getMedicineAudit } from '../controllers/requirementController.js';

const router = express.Router();

router.get('/history', getHistory);
router.get('/today', getTodayRequirement);
router.post('/add-item', addItem);
router.delete('/item/:medicineId', removeItem);
router.post('/generate-pdf', generatePDF);
router.post('/report-data', getReportData); 
router.delete('/history/:id', deleteHistory);
router.get('/medicine-audit', getMedicineAudit);


export default router;
