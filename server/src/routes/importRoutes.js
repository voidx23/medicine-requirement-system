import express from 'express';
import multer from 'multer';
import { importSuppliers, importMedicines } from '../controllers/importController.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'), false);
        }
    }
});

router.post('/suppliers', upload.single('file'), importSuppliers);
router.post('/medicines', upload.single('file'), importMedicines);

export default router;
