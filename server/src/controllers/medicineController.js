import Medicine from '../models/Medicine.js';
import Supplier from '../models/Supplier.js';

// @desc    Get medicines (with search and pagination)
// @route   GET /api/medicines?search=keyword&page=1&limit=20
export const getMedicines = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const { search, supplierId} = req.query;

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

        // 1. Get total count for pagination metadata
        const totalCount = await Medicine.countDocuments(query);

        // 2. Fetch paginated data
        const medicines = await Medicine.find(query)
            .populate('supplierId', 'name')
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
        let { name, supplierId, barcode, supplierName } = req.body;
        name = name.trim();
        const barcodeVal = barcode ? barcode.trim() : '';
        
        // If no ID but name provided (e.g. from Excel import), look it up
        if (!supplierId && supplierName) {
            const supplier = await Supplier.findOne({ 
                name: { $regex: new RegExp(`^${supplierName.trim()}`, 'i') } 
            });
            if (!supplier) {
                return res.status(400).json({ message: `Supplier '${supplierName}' not found` });
            }
            supplierId = supplier._id;
        }

        if (!supplierId) {
             return res.status(400).json({ message: 'Supplier is required' });
        }

        const medicineExists = await Medicine.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') } 
        });
        if (medicineExists) {
            return res.status(400).json({ message: 'Medicine already exists' });
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
            barcode: barcodeVal
        });

        // Fetch again to populate supplier name immediately for frontend
        const fullMedicine = await Medicine.findById(medicine._id).populate('supplierId', 'name');

        res.status(201).json(fullMedicine);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update medicine
// @route   PUT /api/medicines/:id
export const updateMedicine = async (req, res) => {
    try {
            const { name, barcode } = req.body;
            const medicine = await Medicine.findById(req.params.id);
    
            if (medicine) {
                const trimmedName = name ? name.trim() : medicine.name;
                const trimmedBarcode = barcode !== undefined ? barcode.trim() : medicine.barcode;
                
                // Check name duplicate
                if (name && trimmedName.toLowerCase() !== medicine.name.toLowerCase()) {
                    const duplicate = await Medicine.findOne({
                        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
                        _id: { $ne: req.params.id }
                    });
                    if (duplicate) {
                        return res.status(400).json({ message: 'Medicine already exists' });
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
            
            const updatedMedicine = await medicine.save();
            const fullMedicine = await Medicine.findById(updatedMedicine._id).populate('supplierId', 'name');
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
