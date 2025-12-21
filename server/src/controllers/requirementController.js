import PDFDocument from 'pdfkit';
import RequirementList from '../models/RequirementList.js';

// Helper to get today's date with time set to 00:00:00
const getTodayDate = () => {
    // Create date with UTC+4 (Gulf Standard Time) offset
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const dubaiTime = new Date(utc + (3600000 * 4));
    
    dubaiTime.setHours(0, 0, 0, 0);
    return dubaiTime;
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

// @desc Delete requirement list
// @route DELETE /api/requirements/history/:id
export const deleteHistory = async (req, res) => {
    try {
        const {id } = req.params;
        await RequirementList.findByIdAndDelete(id);
        res.json({message: 'Requirement list deleted successfully'});
    }catch (error) {
            res.status(500).json({message: error.message});
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
            if (!medicine) return; // Skip if medicine deleted

            const supplier = medicine.supplierId;
            if (!supplier) return; // Skip if supplier deleted
            
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
        // IMPORTANT: autoPageBreak: false is crucial to prevent "S.No on one page, Name on next"
        const doc = new PDFDocument({ margin: 50, autoPageBreak: false });
        
        // Stream response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=requirement_${today.toISOString().split('T')[0]}.pdf`);
        
        doc.pipe(res);

        // Constants
        const BOTTOM_MARGIN = 750; // A4 height is ~841. leaving ~90px bottom margin
        const COL_SNO = 50;
        const COL_NAME = 100;
        // const COL_QTY = 400; // Removed

        // Helper: Draw Main Title (Only used once)
        const drawMainTitle = () => {
             doc.fontSize(20).text('Medicine Requirement List', { align: 'center' });
             doc.fontSize(12).text(`Date: ${today.toLocaleDateString()}`, { align: 'center' });
             doc.moveDown();
        };

        // Helper: Draw Main Table Header
        const drawTableHeader = (y) => {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text('S.No', COL_SNO, y);
            doc.text('Medicine Name', COL_NAME, y);
            // doc.text('Quantity', COL_QTY, y); // Removed
            
            // Underline
            doc.moveTo(COL_SNO, y + 15).lineTo(550, y + 15).stroke();
            doc.y = y + 25; // Move down after header
        };

        // Initial Title
        drawMainTitle();

        // Helper to check page break
        const checkPageBreak = (neededHeight, currentSupplierInfo) => {
            if (doc.y + neededHeight > BOTTOM_MARGIN) {
                doc.addPage();
                
                // On new page, we DO NOT repeat the Main Title "Medicine Requirement List"
                // But we DO repeat the Supplier header and Table header if we are in the middle of a list

                if (currentSupplierInfo) {
                    doc.fontSize(12).font('Helvetica-Bold').text(`Supplier: ${currentSupplierInfo.name} (Cont.)`, { align: 'left' });
                    doc.moveDown(0.5);
                    drawTableHeader(doc.y);
                }
            }
        };

        // Iterate through grouped suppliers
        Object.values(groupedItems).forEach((group, groupIndex) => {
            const { info, medicines } = group;

            // Estimate header height (Supplier Name + Contact + Table Header) ~ 60px
            checkPageBreak(80, null); // Check if we even have space to start the supplier block

            // Supplier Header
            doc.fontSize(14).font('Helvetica-Bold').text(`Supplier: ${info.name}`);
            if (info.phone) doc.fontSize(10).font('Helvetica').text(`Contact: ${info.phone}`);
            doc.moveDown(0.5);

            // Draw Table Header
            drawTableHeader(doc.y);

            // Medicines
            doc.font('Helvetica').fontSize(12);
            medicines.forEach((med, index) => {
                const nameWidth = 280; // Width allocated for name
                // Calculate height this text will take
                const nameHeight = doc.heightOfString(med.name, { width: nameWidth });
                const rowHeight = Math.max(nameHeight, 20); // At least 20px

                // Check page break with actual row height
                checkPageBreak(rowHeight + 10, info);

                const currentY = doc.y;
                
                // Print S.No
                doc.text(`${index + 1}`, COL_SNO, currentY);
                
                // Print Name (with width limit to wrap correctly)
                doc.text(med.name, COL_NAME, currentY, { width: nameWidth });
                
                // Removed quantity line
                
                // Move cursor down by the actual height of the row
                doc.y = currentY + rowHeight + 5; // 5px padding
            });

            doc.moveDown(1.5); // Space between suppliers
            
            // Separator line
            if (groupIndex < Object.values(groupedItems).length - 1) {
                 if (doc.y < BOTTOM_MARGIN - 20) {
                     doc.moveTo(50, doc.y).lineTo(550, doc.y).dash(5, {space: 10}).stroke();
                     doc.undash();
                     doc.moveDown(1.5);
                 }
            }
        });

        doc.end();

    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
};
