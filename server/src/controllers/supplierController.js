import Supplier from '../models/Supplier.js';

// @desc    Get all suppliers
// @route   GET /api/suppliers
export const getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new supplier
// @route   POST /api/suppliers
export const addSupplier = async (req, res) => {
    try {
        const { name, crNo, phone, email } = req.body;

        // Case-insensitive check
        const supplierExists = await Supplier.findOne({
             name: { $regex: new RegExp(`^${name}$`, 'i') }
        });
        
        if (supplierExists) {
            return res.status(400).json({ message: 'Supplier already exists' });
        }

        const supplier = await Supplier.create({
            name,
            crNo,
            phone,
            email
        });

        res.status(201).json(supplier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
export const updateSupplier = async (req, res) => {
    try {
        const { name, crNo, phone, email } = req.body;
        const supplier = await Supplier.findById(req.params.id);

        if (supplier) {
            // If name is changing, check duplicate
            if (name && name.toLowerCase() !== supplier.name.toLowerCase()) {
                 const duplicate = await Supplier.findOne({
                    name: { $regex: new RegExp(`^${name}$`, 'i') }
                 });
                 if (duplicate) {
                    return res.status(400).json({ message: 'Supplier name already exists' });
                 }
            }

            supplier.name = name || supplier.name;
            supplier.crNo = crNo || supplier.crNo;
            supplier.phone = phone || supplier.phone;
            supplier.email = email || supplier.email;

            const updatedSupplier = await supplier.save();
            res.json(updatedSupplier);
        } else {
            res.status(404).json({ message: 'Supplier not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Soft delete supplier
// @route   DELETE /api/suppliers/:id
export const deleteSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (supplier) {
            supplier.isActive = false;
            await supplier.save();
            res.json({ message: 'Supplier removed' });
        } else {
            res.status(404).json({ message: 'Supplier not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
