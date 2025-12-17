import express, { json } from 'express';
import cors from 'cors';
import supplierRoutes from './routes/supplierRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';

const app = express();

// Middleware
app.use(cors());
app.use(json());

// Routes
console.log('Registering Routes...');
app.use('/api/suppliers', supplierRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/requirements', requirementRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.send('API is running...');
});

export default app;
