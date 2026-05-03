import express from 'express';
import multer from 'multer';
import { importSuppliers, importMedicines, updateMedicineUnits } from '../controllers/importController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

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

router.post('/suppliers', protect, requirePermission('import_excel'), upload.single('file'), importSuppliers);
router.post('/medicines', protect, requirePermission('import_excel'), upload.single('file'), importMedicines);
router.post('/units', protect, requirePermission('import_excel'), upload.single('file'), updateMedicineUnits);

export default router;
