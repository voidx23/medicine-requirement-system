import express from 'express';
import { getCommits, getSystemVersion, forceRefreshClients, updateTelemetry } from '../controllers/systemController.js';
import { protect, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/commits', getCommits);

// Version Polling Endpoints
router.get('/version', getSystemVersion); // Publicly accessible to ping
router.post('/force-refresh', protect, superAdmin, forceRefreshClients);
router.post('/telemetry', protect, updateTelemetry); // Protected telemetry endpoint

export default router;
