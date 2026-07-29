import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createInvoice, getInvoices, parseInvoiceExcel } from '../controllers/invoiceController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

// Ensure upload directory exists
const uploadDir = 'uploads/invoices';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, Excel sheets, and images are allowed.'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

router.use(protect);

router.post('/', requirePermission('receive_purchase_orders'), upload.single('invoiceFile'), createInvoice);
router.post('/parse-excel', requirePermission('receive_purchase_orders'), upload.single('invoiceFile'), parseInvoiceExcel);
router.get('/', requirePermission('view_order_history'), getInvoices);

export default router;
