import express from 'express';
import { getTodayRequirement, addItem, removeItem, generatePDF, getHistory, deleteHistory, getReportData } from '../controllers/requirementController.js';

const router = express.Router();

router.get('/history', getHistory);
router.get('/today', getTodayRequirement);
router.post('/add-item', addItem);
router.delete('/item/:medicineId', removeItem);
router.post('/generate-pdf', generatePDF);
router.post('/report-data', getReportData); // New Route for JSON Report Data
router.delete('/history/:id', deleteHistory);


export default router;
