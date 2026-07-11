import Medicine from '../models/Medicine.js';
import Supplier from '../models/Supplier.js';

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// @desc    Get medicines (with search and pagination)
// @route   GET /api/medicines?search=keyword&page=1&limit=20
export const getMedicines = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        
        // If limit is '0' or 'all', return everything (max 10000 for safety)
        let limit = parseInt(req.query.limit) || 20;
        if (req.query.limit === '0' || req.query.limit === 'all') {
            limit = 10000;
        }

        const skip = (page - 1) * limit;

        const { search, supplierId, divisionId, filterType } = req.query;

        const keyword = search
            ? {
                name: {
                    $regex: new RegExp('(^|\\s)' + search, 'i'),
                },
            }
            : {};

        const query = { ...keyword, isActive: true };

        if(supplierId) {
            query.supplierId = supplierId;
        }

        if(divisionId) {
            query.divisionId = divisionId;
        }

        if (filterType === 'unverified_units') {
            query.unitVerified = { $ne: true };
        } else if (filterType === 'missing_prices') {
            query.$or = [
                { costPrice: { $exists: false } }, 
                { costPrice: null }, 
                { costPrice: 0 }, 
                { sellingPrice: { $exists: false } }, 
                { sellingPrice: null }, 
                { sellingPrice: 0 }
            ];
        }

        // 1. Get total count for pagination metadata
        const totalCount = await Medicine.countDocuments(query);

        // 2. Fetch paginated data
        const medicines = await Medicine.find(query)
            .populate('supplierId', 'name')
            .populate('divisionId', 'divisionName')
            .collation({ locale: 'en', strength: 2 }) // Case-insensitive sort
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        res.json({
            medicines,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new medicine
// @route   POST /api/medicines
export const addMedicine = async (req, res) => {
    try {
        let { name, supplierId, barcode, supplierName, costPrice, sellingPrice, divisionId, unit, status } = req.body;
        name = String(name || '').trim();
        const barcodeVal = barcode !== undefined && barcode !== null ? String(barcode).trim() : '';
        
        // If no ID but name provided (e.g. from Excel import), look it up
        if (!supplierId && supplierName) {
            const supplier = await Supplier.findOne({ 
                name: { $regex: new RegExp(`^${String(supplierName).trim()}`, 'i') } 
            });
            if (!supplier) {
                return res.status(400).json({ message: `Supplier '${supplierName}' not found` });
            }
            supplierId = supplier._id;
        }

        if (!supplierId) {
             return res.status(400).json({ message: 'Supplier is required' });
        }

        // Check for duplicate Name globally (ignore supplier)
        const medicineExists = await Medicine.findOne({ 
            name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }
        }).populate('supplierId', 'name');
        
        if (medicineExists) {
            return res.status(400).json({ message: `Medicine already exists in the system (Supplier: ${medicineExists.supplierId?.name || 'Unknown'})` });
        }

        // Check barcode duplicate if provided
        if (barcodeVal) {
            const barcodeExists = await Medicine.findOne({ barcode: barcodeVal });
            if (barcodeExists) {
                return res.status(400).json({ message: 'Barcode already assigned to another medicine' });
            }
        }

        const medicine = await Medicine.create({
            name,
            supplierId,
            barcode: barcodeVal,
            costPrice: Number(costPrice) || 0,
            sellingPrice: Number(sellingPrice) || 0,
            divisionId: divisionId || undefined,
            unit: unit || 'Box',
            status: status || 'active'
        });

        // Fetch again to populate supplier and division name immediately for frontend
        const fullMedicine = await Medicine.findById(medicine._id)
            .populate('supplierId', 'name')
            .populate('divisionId', 'divisionName');

        res.status(201).json(fullMedicine);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update medicine
// @route   PUT /api/medicines/:id
export const updateMedicine = async (req, res) => {
    try {
            const { name, barcode, supplierId, costPrice, sellingPrice, unitsPerBox, divisionId, unit, status } = req.body;
            const medicine = await Medicine.findById(req.params.id);
    
            if (medicine) {
                const trimmedName = name !== undefined && name !== null ? String(name).trim() : medicine.name;
                const trimmedBarcode = barcode !== undefined && barcode !== null ? String(barcode).trim() : medicine.barcode;
                
                if (name && trimmedName.toLowerCase() !== medicine.name.toLowerCase()) {
                    const duplicate = await Medicine.findOne({
                        name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
                        _id: { $ne: req.params.id }
                    }).populate('supplierId', 'name');
                    
                    if (duplicate) {
                        return res.status(400).json({ message: `Medicine already exists in the system (Supplier: ${duplicate.supplierId?.name || 'Unknown'})` });
                    }
                }

                // Check barcode duplicate
                if (trimmedBarcode && trimmedBarcode !== medicine.barcode) {
                     const barcodeDuplicate = await Medicine.findOne({
                        barcode: trimmedBarcode,
                        _id: { $ne: req.params.id }
                    });
                    if (barcodeDuplicate) {
                        return res.status(400).json({ message: 'Barcode already assigned to another medicine' });
                    }
                }
    
                medicine.name = trimmedName;
                medicine.barcode = trimmedBarcode;
                if (supplierId) {
                    medicine.supplierId = supplierId;
                }
                if (costPrice !== undefined) medicine.costPrice = Number(costPrice) || 0;
                if (sellingPrice !== undefined) medicine.sellingPrice = Number(sellingPrice) || 0;
                if (unitsPerBox !== undefined) {
                    medicine.unitsPerBox = Number(unitsPerBox) || 1;
                    medicine.unitVerified = true;
                }
                if (divisionId !== undefined) {
                    medicine.divisionId = divisionId || undefined;
                }
                if (unit !== undefined) {
                    medicine.unit = unit || 'Box';
                }
                if (status !== undefined) {
                    medicine.status = status;
                }
            
            const updatedMedicine = await medicine.save();
            const fullMedicine = await Medicine.findById(updatedMedicine._id)
                .populate('supplierId', 'name')
                .populate('divisionId', 'divisionName');
            res.json(fullMedicine);
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Soft delete medicine
// @route   DELETE /api/medicines/:id
export const deleteMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);

        if (medicine) {
            medicine.isActive = false;
            await medicine.save();
            res.json({ message: 'Medicine removed' });
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk update pricing
// @route   PUT /api/medicines/bulk-pricing
// @access  Private (Admin)
export const bulkUpdatePricing = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ message: 'Invalid data format' });
        }

        const summary = { updated: 0, skipped: 0, errors: [] };

        for (const item of items) {
            try {
                let medicine = null;

                // 1. Try by exact Barcode match first
                if (item.barcode) {
                    medicine = await Medicine.findOne({ barcode: String(item.barcode).trim() });
                }

                // 2. Fallback to exact Name match (case-insensitive) if no barcode match found
                if (!medicine && item.name) {
                    medicine = await Medicine.findOne({ 
                        name: { $regex: new RegExp(`^${escapeRegex(String(item.name).trim())}$`, 'i') }
                    });
                }

                if (!medicine) {
                    summary.errors.push(`Item not found: ${item.name || item.barcode}`);
                    summary.skipped++;
                    continue;
                }

                // Update prices
                let isModified = false;
                if (item.costPrice !== undefined) {
                    const cp = parseFloat(item.costPrice);
                    if (!isNaN(cp) && medicine.costPrice !== cp) {
                        medicine.costPrice = cp;
                        isModified = true;
                    }
                }
                
                if (item.sellingPrice !== undefined) {
                    const sp = parseFloat(item.sellingPrice);
                    if (!isNaN(sp) && medicine.sellingPrice !== sp) {
                        medicine.sellingPrice = sp;
                        isModified = true;
                    }
                }

                if (isModified) {
                    await medicine.save();
                    summary.updated++;
                } else {
                    summary.skipped++;
                    summary.errors.push(`Skipped: ${medicine.name} (Price is already up to date)`);
                }

            } catch (err) {
                summary.errors.push(`Error updating ${item.name || item.barcode}: ${err.message}`);
                summary.skipped++;
            }
        }

        res.json({ message: 'Bulk pricing update completed', summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
