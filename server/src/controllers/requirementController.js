import PDFDocument from 'pdfkit';
import RequirementList from '../models/RequirementList.js';

// Helper to get today's date with time set to 00:00:00
const getTodayDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

// @desc    Get all requirement lists (History)
// @route   GET /api/requirements/history
export const getHistory = async (req, res) => {
    try {
        const history = await RequirementList.find()
            .sort({ date: -1 }) // Newest first
            .select('date items') // Select fields to show
            .populate('items.medicineId', 'name'); // Populate medicine name for preview

        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get today's requirement list (create if not exists)
// @route   GET /api/requirements/today
export const getTodayRequirement = async (req, res) => {
    try {
        const today = getTodayDate();

        let requirementList = await RequirementList.findOne({ date: today })
            .populate({
                path: 'items.medicineId',
                populate: { path: 'supplierId', select: 'name' } // Nested populate for supplier
            });

        if (!requirementList) {
            requirementList = await RequirementList.create({
                date: today,
                items: []
            });
        }

        res.json(requirementList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add item to requirement list
// @route   POST /api/requirements/add-item
export const addItem = async (req, res) => {
    try {
        const { medicineId } = req.body;
        const today = getTodayDate();

        let requirementList = await RequirementList.findOne({ date: today });

        if (!requirementList) {
            requirementList = await RequirementList.create({ date: today, items: [] });
        }

        // Check duplicate
        const exists = requirementList.items.find(
            (item) => item.medicineId.toString() === medicineId
        );

        if (exists) {
            return res.status(400).json({ message: 'Medicine already in today\'s list' });
        }

        requirementList.items.push({ medicineId });
        await requirementList.save();

        // return updated list with populated fields
        const updatedList = await RequirementList.findById(requirementList._id)
            .populate({
                path: 'items.medicineId',
                populate: { path: 'supplierId', select: 'name' }
            });

        res.json(updatedList);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Remove item from list
// @route   DELETE /api/requirements/item/:medicineId
export const removeItem = async (req, res) => {
    try {
        const { medicineId } = req.params;
        const today = getTodayDate();

        const requirementList = await RequirementList.findOne({ date: today });

        if (requirementList) {
            requirementList.items = requirementList.items.filter(
                (item) => item.medicineId.toString() !== medicineId
            );
            await requirementList.save();
        }

        res.json(requirementList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Generate PDF grouped by supplier
// @route   POST /api/requirements/generate-pdf
export const generatePDF = async (req, res) => {
    try {
        const { supplierIds } = req.body; // Array of selected supplier IDs
        const today = getTodayDate();

        const requirementList = await RequirementList.findOne({ date: today })
            .populate({
                path: 'items.medicineId',
                populate: { path: 'supplierId', select: 'name phone email' }
            });

        if (!requirementList || requirementList.items.length === 0) {
            return res.status(400).json({ message: 'No items in today\'s list' });
        }

        // Group items by Supplier
        const groupedItems = {};
        
        requirementList.items.forEach(item => {
            const medicine = item.medicineId;
            const supplier = medicine.supplierId;
            
            // Only include if supplier is selected (or include all if supplierIds is empty/undefined)
            const isSelected = !supplierIds || supplierIds.length === 0 || supplierIds.includes(supplier._id.toString());
            
            if (isSelected) {
                if (!groupedItems[supplier._id]) {
                    groupedItems[supplier._id] = {
                        info: supplier,
                        medicines: []
                    };
                }
                groupedItems[supplier._id].medicines.push(medicine);
            }
        });

        if (Object.keys(groupedItems).length === 0) {
            return res.status(400).json({ message: 'No items found for selected suppliers' });
        }

        // Generate PDF
        const doc = new PDFDocument();
        
        // Stream response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=requirement_${today.toISOString().split('T')[0]}.pdf`);
        
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Medicine Requirement List', { align: 'center' });
        doc.fontSize(12).text(`Date: ${today.toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Iterate through grouped suppliers
        Object.values(groupedItems).forEach((group) => {
            const { info, medicines } = group;

            // Supplier Header
            doc.fontSize(14).font('Helvetica-Bold').text(`Supplier: ${info.name}`);
            if (info.phone) doc.fontSize(10).font('Helvetica').text(`Contact: ${info.phone}`);
            doc.moveDown(0.5);

            // Table Header
            let y = doc.y;
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text('S.No', 50, y);
            doc.text('Medicine Name', 100, y);
            doc.text('', 400, y); // Placeholder for Quantity if added later
            
            doc.underline(50, y + 15, 500, 1).moveDown();

            // Medicines
            doc.font('Helvetica').fontSize(12);
            medicines.forEach((med, index) => {
                const currentY = doc.y;
                doc.text(`${index + 1}`, 50, currentY);
                doc.text(med.name, 100, currentY);
                doc.moveDown(0.5);
            });

            doc.moveDown(2); // Space between suppliers
        });

        doc.end();

    } catch (error) {
        // If headers not sent, return error
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
};
