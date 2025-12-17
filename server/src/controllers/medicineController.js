import Medicine from '../models/Medicine.js';

// @desc    Get medicines (with search)
// @route   GET /api/medicines?search=keyword
export const getMedicines = async (req, res) => {
    try {
        const keyword = req.query.search
            ? {
                name: {
                    $regex: req.query.search,
                    $options: 'i', // case insensitive
                },
            }
            : {};

        // Find medicines match keyword, populate supplier info
        const medicines = await Medicine.find({ ...keyword, isActive: true })
            .populate('supplierId', 'name') // "Join" with Supplier to get name
            .limit(20); // Limit results for performance

        res.json(medicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new medicine
// @route   POST /api/medicines
export const addMedicine = async (req, res) => {
    try {
        let { name, supplierId } = req.body;
        name = name.trim();

        const medicineExists = await Medicine.findOne({ name });
        if (medicineExists) {
            return res.status(400).json({ message: 'Medicine already exists' });
        }

        const medicine = await Medicine.create({
            name,
            supplierId
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
        const { name } = req.body;
        const medicine = await Medicine.findById(req.params.id);

        if (medicine) {
            medicine.name = name ? name.trim() : medicine.name;
            
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
