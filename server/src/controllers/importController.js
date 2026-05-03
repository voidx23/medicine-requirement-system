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

            if (!name) {
                errors.push(`Row ${importedCount + skippedCount + 2}: Missing Name`);
                skippedCount++;
                continue;
            }

            // Create query for duplicate check
            const query = { $or: [{ name: { $regex: new RegExp(`^${name}$`, 'i') } }] };
            if (crNo) {
                query.$or.push({ crNo });
            }

            const exists = await Supplier.findOne(query);
            if (exists) {
                skippedCount++;
                continue;
            }

            await Supplier.create({ name, crNo: crNo || '' });
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

// Helper to escape regex special characters
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

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
                name: { $regex: new RegExp(`^${escapeRegex(medicineName)}$`, 'i') },
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

// @desc    Bulk update existing medicine units from Excel
// @route   POST /api/import/units
export const updateMedicineUnits = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Find the actual header row
        const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(aoa.length, 10); i++) {
            const rowStr = (aoa[i] || []).map(c => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('product') || rowStr.includes('medicine') || rowStr.includes('barcode')) {
                headerRowIndex = i;
                break;
            }
        }

        const data = xlsx.utils.sheet_to_json(sheet, { range: headerRowIndex });

        // Set up streaming response
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.flushHeaders();

        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Helper to parse custom units like "BOX-1", "box -13", "nos", "nos0"
        const parseCustomUnit = (val) => {
            if (!val) return NaN;
            const str = val.toString().trim().toLowerCase();
            if (str === 'nos') return 1;
            if (str === 'nos0') return 10;
            if (str === 'nos00') return 100;
            
            // Extract any numeric digits from the string (handles "box-30", "box 30", "box - 30", etc.)
            const match = str.match(/\d+/);
            if (match) {
                return parseInt(match[0], 10);
            }

            return NaN;
        };

        // Helper to normalize strings for robust matching (removes extra spaces between words)
        const normalizeString = (str) => {
            if (!str) return '';
            return String(str).toLowerCase().replace(/\s+/g, ' ').trim();
        };

        // Pre-load all medicines for O(1) lookups
        const allMedicines = await Medicine.find({}).lean();
        const medByBarcode = new Map();
        const medByName = new Map();
        for (const m of allMedicines) {
            if (m.barcode) medByBarcode.set(m.barcode.toString().trim(), m);
            if (m.name) {
                medByName.set(normalizeString(m.name), m);
            }
        }

        const chunkSize = 500;
        for (let i = 0; i < data.length; i += chunkSize) {
            const dataChunk = data.slice(i, i + chunkSize);
            const bulkOps = [];

            for (let j = 0; j < dataChunk.length; j++) {
                const originalRow = dataChunk[j];
                const rowNum = i + j + 2; // +1 for 0-index, +1 for header
                
                // Normalize row keys to lowercase and trim spaces
                const row = {};
                for (const key in originalRow) {
                    row[key.toLowerCase().trim()] = originalRow[key];
                }

                const medicineName = (row['medicine name'] || row['product'] || row['name'])?.toString().trim();
                const normalizedMedName = normalizeString(medicineName);
                const barcode = row['barcode']?.toString().trim();
                // Find units column flexibly
                let unitsVal = row['unit'] || row['units'];
                if (unitsVal === undefined) {
                    for (const key in row) {
                        if (key.includes('unit') || key.includes('pack') || key.includes('qty') || key.includes('box')) {
                            unitsVal = row[key];
                            break;
                        }
                    }
                }

                const unitsPerBox = parseCustomUnit(unitsVal);

                if (!medicineName && !barcode) {
                    errors.push(`[Row ${rowNum}] Skipped: Missing Product Name or Barcode`);
                    skippedCount++;
                    continue;
                }

                if (isNaN(unitsPerBox) || unitsPerBox < 1) {
                    const nameLabel = medicineName || barcode;
                    const actualVal = unitsVal === undefined ? 'empty/missing column' : `"${unitsVal}"`;
                    errors.push(`[Row ${rowNum}] Skipped: Invalid Unit (${actualVal}) for "${nameLabel}"`);
                    skippedCount++;
                    continue;
                }

                // Find existing medicine instantly from memory maps
                let medicineExists = null;
                if (barcode && medByBarcode.has(barcode)) {
                    medicineExists = medByBarcode.get(barcode);
                } else if (normalizedMedName && medByName.has(normalizedMedName)) {
                    medicineExists = medByName.get(normalizedMedName);
                }

                if (medicineExists) {
                    const updateDoc = { unitsPerBox, unitVerified: true };
                    if (barcode && medicineExists.barcode !== barcode) {
                        updateDoc.barcode = barcode;
                    }
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: medicineExists._id },
                            update: { $set: updateDoc }
                        }
                    });
                    updatedCount++;
                    errors.push(`[Success] Updated: "${medicineExists.name}" -> ${unitsPerBox} Units`);
                } else {
                    const nameLabel = medicineName || barcode;
                    errors.push(`[Row ${rowNum}] Skipped: Item "${nameLabel}" not found in database.`);
                    skippedCount++;
                }
            }

            // Execute database updates for this chunk
            if (bulkOps.length > 0) {
                await Medicine.bulkWrite(bulkOps);
            }

            // Stream chunk progress to frontend
            const percent = Math.round(((i + dataChunk.length) / data.length) * 100);
            res.write(JSON.stringify({ 
                type: 'progress', 
                percent: Math.min(percent, 99), 
                current: Math.min(i + dataChunk.length, data.length), 
                total: data.length 
            }) + '\n');
        }

        // Send 100% progress right before completing
        res.write(JSON.stringify({ type: 'progress', percent: 100, current: data.length, total: data.length }) + '\n');

        // Send final payload
        res.write(JSON.stringify({
            type: 'complete',
            message: 'Unit update completed',
            summary: {
                total: data.length,
                updated: updatedCount,
                skipped: skippedCount,
                logs: errors
            }
        }) + '\n');
        
        res.end();
    } catch (error) {
        // If headers haven't been sent yet, send a standard error JSON response
        if (!res.headersSent) {
            return res.status(500).json({ message: error.message });
        }
        // Otherwise, send the error through the stream
        res.write(JSON.stringify({ type: 'error', message: error.message }) + '\n');
        res.end();
    }
};
