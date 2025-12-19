import express from 'express';
import { getTodayRequirement, addItem, removeItem, generatePDF, getHistory, deleteHistory } from '../controllers/requirementController.js';

const router = express.Router();

router.get('/history', getHistory);
router.get('/today', getTodayRequirement);
router.post('/add-item', addItem);
router.delete('/item/:medicineId', removeItem);
router.post('/generate-pdf', generatePDF);
router.delete('/history/:id', deleteHistory);


export default router;
