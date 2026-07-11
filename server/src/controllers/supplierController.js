import Supplier from '../models/Supplier.js';
import SupplierDivision from '../models/SupplierDivision.js';

// @desc    Get all suppliers
// @route   GET /api/suppliers
export const getSuppliers = async (req, res) => {
    try {
        // Find both active and inactive if needed, but default to active
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
        const { name, crNo, phone, email, address, contact, status } = req.body;

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
            email,
            address,
            contact,
            status: status || 'active'
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
        const { name, crNo, phone, email, address, contact, status } = req.body;
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
            supplier.address = address !== undefined ? address : supplier.address;
            supplier.contact = contact !== undefined ? contact : supplier.contact;
            supplier.status = status || supplier.status;

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
            supplier.status = 'inactive';
            await supplier.save();
            res.json({ message: 'Supplier removed' });
        } else {
            res.status(404).json({ message: 'Supplier not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get divisions for a supplier
// @route   GET /api/suppliers/:supplierId/divisions
export const getDivisions = async (req, res) => {
    try {
        const divisions = await SupplierDivision.find({ 
            supplierId: req.params.supplierId, 
            status: 'active' 
        }).sort({ divisionName: 1 });
        res.json(divisions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add division for a supplier
// @route   POST /api/suppliers/:supplierId/divisions
export const addDivision = async (req, res) => {
    try {
        const { divisionName, description } = req.body;
        const supplierId = req.params.supplierId;

        // Check if supplier exists
        const supplier = await Supplier.findById(supplierId);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        // Case-insensitive check
        const divisionExists = await SupplierDivision.findOne({
            supplierId,
            divisionName: { $regex: new RegExp(`^${divisionName}$`, 'i') },
            status: 'active'
        });

        if (divisionExists) {
            return res.status(400).json({ message: 'Division name already exists for this supplier' });
        }

        const division = await SupplierDivision.create({
            supplierId,
            divisionName,
            description
        });

        res.status(201).json(division);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update division
// @route   PUT /api/suppliers/:supplierId/divisions/:id
export const updateDivision = async (req, res) => {
    try {
        const { divisionName, description } = req.body;
        const division = await SupplierDivision.findOne({ 
            _id: req.params.id, 
            supplierId: req.params.supplierId 
        });

        if (division) {
            // Check case-insensitive duplicate if name is changing
            if (divisionName && divisionName.toLowerCase() !== division.divisionName.toLowerCase()) {
                const duplicate = await SupplierDivision.findOne({
                    supplierId: req.params.supplierId,
                    divisionName: { $regex: new RegExp(`^${divisionName}$`, 'i') },
                    status: 'active'
                });
                if (duplicate) {
                    return res.status(400).json({ message: 'Division name already exists for this supplier' });
                }
            }

            division.divisionName = divisionName || division.divisionName;
            division.description = description !== undefined ? description : division.description;

            const updatedDivision = await division.save();
            res.json(updatedDivision);
        } else {
            res.status(404).json({ message: 'Division not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete division (soft delete)
// @route   DELETE /api/suppliers/:supplierId/divisions/:id
export const deleteDivision = async (req, res) => {
    try {
        const division = await SupplierDivision.findOne({ 
            _id: req.params.id, 
            supplierId: req.params.supplierId 
        });

        if (division) {
            division.status = 'inactive';
            await division.save();
            res.json({ message: 'Division removed' });
        } else {
            res.status(404).json({ message: 'Division not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
