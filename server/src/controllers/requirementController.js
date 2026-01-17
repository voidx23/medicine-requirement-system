import PDFDocument from 'pdfkit';
import RequirementList from '../models/RequirementList.js';

// Helper to get today's date with time set to 00:00:00
// Helper to get today's date (Dubai Midnight)
const getTodayDate = () => {
    // Current time
    const now = new Date();
    // UTC Timestamp
    const utcTimestamp = now.getTime();
    
    // Dubai is UTC+4. 
    // We want the timestamp that REPRESENTS Dubai Midnight.
    // Dubai Midnight = 00:00 Dubai = 20:00 UTC (Previous Day).
    
    // Algorithm to find this specific timestamp regardless of server TZ:
    // 1. Add 4 hours to current UTC timestamp. This gives us a timestamp where 
    //    the UTC value matches the Dubai wall-clock time.
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const dubaiFakeUTC = new Date(utcTimestamp + dubaiOffset);
    
    // 2. Floor to Day Start using UTC methods.
    dubaiFakeUTC.setUTCHours(0, 0, 0, 0);
    
    // 3. Subtract the offset to get back to the Real UTC timestamp.
    const dubaiMidnightRealUTC = new Date(dubaiFakeUTC.getTime() - dubaiOffset);
    
    return dubaiMidnightRealUTC;
};

// --- Shared Helper for Report Logic ---
const fetchReportDataHelper = async ({ startDate, endDate, supplierIds, listId }) => {
    let itemsToProcess = [];
    let reportTitleDate = '';

    if (listId) {
        // Single List Mode (Existing behavior)
        const list = await RequirementList.findById(listId)
            .populate({
                path: 'items.medicineId',
                select: 'name supplierId',
                populate: { path: 'supplierId', select: 'name phone email' }
            });
        
        if (list) {
            itemsToProcess = list.items;
            reportTitleDate = new Date(list.date);
        }
    } else {
        // Date Range Mode (New Report Feature)
        // Default to today if no dates provided
        let query = {};
        
        if (startDate && endDate) {
            // Adjust dates to cover full days (Start of startDate to End of endDate)
            const sDate = new Date(startDate); 
            sDate.setHours(0,0,0,0);
            
            const eDate = new Date(endDate);
            eDate.setHours(23,59,59,999);

            query.date = { $gte: sDate, $lte: eDate };
            // Ensure proper string formatting for the report title
            reportTitleDate = `${sDate.toLocaleDateString('en-GB')} - ${eDate.toLocaleDateString('en-GB')}`;
        } else {
            // Fallback to Today
            const today = getTodayDate();
            query.date = today;
            reportTitleDate = today;
        }

        const lists = await RequirementList.find(query)
            .populate({
                path: 'items.medicineId',
                select: 'name supplierId',
                populate: { path: 'supplierId', select: 'name phone email' }
            });

        // Flatten all items from all found lists
        lists.forEach(list => {
            itemsToProcess = itemsToProcess.concat(list.items);
        });
    }

    if (!itemsToProcess.length) {
        return { groupedItems: {}, dateStr: reportTitleDate, totalItems: 0 };
    }

    // Process & Deduplicate
    const groupedItems = {};
    const processedMedicineIds = new Set(); 

    itemsToProcess.forEach(item => {
        const medicine = item.medicineId;
        if (!medicine) return; // Skip deleted medicines

        const supplier = medicine.supplierId;
        if (!supplier) return; // Skip deleted suppliers

        // Filter by specific suppliers if requested
        if (supplierIds && supplierIds.length > 0 && !supplierIds.includes(supplier._id.toString())) {
            return;
        }

        const supplierId = supplier._id.toString();

        if (!groupedItems[supplierId]) {
            groupedItems[supplierId] = {
                info: supplier,
                medicines: [] 
            };
        }

        // Deduplication Check
        // We create a unique key: SupplierID + MedicineID
        const uniqueKey = `${supplierId}-${medicine._id.toString()}`;
        
        if (!processedMedicineIds.has(uniqueKey)) {
            groupedItems[supplierId].medicines.push(medicine);
            processedMedicineIds.add(uniqueKey);
        }
    });

    return { 
        groupedItems, 
        dateStr: reportTitleDate,
        totalItems: processedMedicineIds.size
    };
};


// @desc    Get all requirement lists (History)
// @route   GET /api/requirements/history
export const getHistory = async (req, res) => {
    try {
        const history = await RequirementList.find()
            .sort({ date: -1 }) // Newest first
            .select('date items') // Select fields to show
            .populate({
                path: 'items.medicineId',
                select: 'name supplierId',
                populate: {
                    path: 'supplierId',
                    select: 'name'
                }
            });

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

// @desc    Get Report Data (JSON) for Preview
// @route   POST /api/requirements/report-data
export const getReportData = async (req, res) => {
    try {
        const { startDate, endDate, supplierIds } = req.body;
        
        const { groupedItems, totalItems } = await fetchReportDataHelper({ 
            startDate, endDate, supplierIds 
        });

        // Convert grouped object to array for easier frontend map
        const result = Object.values(groupedItems).map(group => ({
            supplier: group.info,
            medicines: group.medicines
        }));

        res.json({ data: result, totalItems });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Generate PDF (Grouped by supplier, Deduplicated)
// @route   POST /api/requirements/generate-pdf
export const generatePDF = async (req, res) => {
    try {
        const { supplierIds, listId, startDate, endDate } = req.body;

        const { groupedItems, dateStr, totalItems } = await fetchReportDataHelper({ 
            startDate, endDate, supplierIds, listId 
        });

        if (totalItems === 0) {
            return res.status(400).json({ message: 'No items found for the selected criteria' });
        }

        // Generate PDF
        // IMPORTANT: autoPageBreak: false is crucial to prevent "S.No on one page, Name on next"
        const doc = new PDFDocument({ margin: 50, autoPageBreak: false });
        
        let filenameDate = 'report';
        if (dateStr instanceof Date) {
            // Fix: Force Dubai timezone for filename
            filenameDate = dateStr.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
        } else {
             // If dateStr is a range string, sanitize it
             filenameDate = 'range_report';
        }

        // Stream response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=requirement_${filenameDate}.pdf`);
        
        doc.pipe(res);

        // Constants
        const BOTTOM_MARGIN = 750; // A4 height is ~841. leaving ~90px bottom margin
        const COL_SNO = 50;
        const COL_NAME = 100;
        // const COL_QTY = 400; // Removed

        // Helper: Draw Main Title (Only used once)
        const drawMainTitle = () => {
             doc.fontSize(20).text('Medicine Requirement List', { align: 'center' });
             
             let dateDisplay = '';
             if (dateStr instanceof Date) {
                 // Fix: Force Dubai timezone for report title
                 dateDisplay = dateStr.toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' });
             } else {
                 dateDisplay = String(dateStr);
             }

             doc.fontSize(12).text(`Date Range: ${dateDisplay}`, { align: 'center' });
             doc.moveDown();
        };

        // Helper: Draw Main Table Header
        const drawTableHeader = (y) => {
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text('S.No', COL_SNO, y);
            doc.text('Medicine Name', COL_NAME, y);
            
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
