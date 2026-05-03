import express, { json } from 'express';
import cors from 'cors';
import supplierRoutes from './routes/supplierRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import importRoutes from './routes/importRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import authRoutes from './routes/authRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import storeStaffRoutes from './routes/storeStaffRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const app = express();

// Health Check Route for Cron-Job Pinging (Instantly accessible, bypassing middleware)
app.get('/api/ping', (req, res) => {
    res.status(200).send('Server is awake');
});

// Middleware
app.use(express.json()); // Body parser
app.use(cors()); // Enable CORS

app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/import', importRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/store-staff', storeStaffRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/notifications', notificationRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.send('API is running...');
});

export default app;
