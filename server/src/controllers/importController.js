import xlsx from 'xlsx';
import Supplier from '../models/Supplier.js';
import Medicine from '../models/Medicine.js';

// @desc    Import suppliers from Excel
// @route   POST /api/import/suppliers
export const importSuppliers = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let importedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const row of data) {
            const name = row['Name']?.toString().trim();
            const crNo = row['CR No']?.toString().trim();

            if (!name || !crNo) {
                errors.push(`Row ${importedCount + skippedCount + 2}: Missing Name or CR No`);
                skippedCount++;
                continue;
            }

            const exists = await Supplier.findOne({ $or: [{ name }, { crNo }] });
            if (exists) {
                skippedCount++;
                continue;
            }

            await Supplier.create({ name, crNo });
            importedCount++;
        }

        res.json({
            message: 'Import completed',
            summary: {
                total: data.length,
                imported: importedCount,
                skipped: skippedCount,
                errors
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Import medicines from Excel
// @route   POST /api/import/medicines
export const importMedicines = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let importedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const row of data) {
            const medicineName = row['Medicine Name']?.toString().trim();
            const supplierName = row['Supplier Name']?.toString().trim();

            if (!medicineName || !supplierName) {
                errors.push(`Row ${importedCount + skippedCount + 2}: Missing Medicine Name or Supplier Name`);
                skippedCount++;
                continue;
            }

            const supplier = await Supplier.findOne({ name: { $regex: new RegExp(`^${supplierName}$`, 'i') } });
            if (!supplier) {
                errors.push(`Row ${importedCount + skippedCount + 2}: Supplier "${supplierName}" not found`);
                skippedCount++;
                continue;
            }

            const medicineExists = await Medicine.findOne({ 
                name: { $regex: new RegExp(`^${medicineName}$`, 'i') },
                supplierId: supplier._id 
            });

            if (medicineExists) {
                skippedCount++;
                continue;
            }

            await Medicine.create({
                name: medicineName,
                supplierId: supplier._id
            });
            importedCount++;
        }

        res.json({
            message: 'Import completed',
            summary: {
                total: data.length,
                imported: importedCount,
                skipped: skippedCount,
                errors
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
