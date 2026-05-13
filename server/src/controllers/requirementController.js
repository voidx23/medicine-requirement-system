import PDFDocument from 'pdfkit';
import RequirementList from '../models/RequirementList.js';
import PharmacistRequest from '../models/PharmacistRequest.js';

// Helper to get today's date with time set to 00:00:00
// Helper to get today's date (Dubai Midnight)
// Helper to get today's date (Dubai Midnight)
const getTodayDate = () => {
    // Current time
    const now = new Date();
    // UTC Timestamp
    const utcTimestamp = now.getTime();
    
    // Dubai is UTC+4. 
    // We want the timestamp that REPRESENTS Dubai Midnight.
    // Dubai Midnight = 00:00 Dubai = 20:00 UTC (Previous Day).
    
    // Algorithm:
    // 1. Shift current time to "Dubai Wall Clock Time" (UTC+4)
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const dubaiTime = new Date(utcTimestamp + dubaiOffset);
    
    // 2. Floor to Day Start using UTC methods (00:00:00)
    dubaiTime.setUTCHours(0, 0, 0, 0);
    
    // 3. Shift back to real UTC (-4h)
    // This gives us the UTC timestamp corresponding to 00:00 Dubai Time
    const dubaiMidnightRealUTC = new Date(dubaiTime.getTime() - dubaiOffset);
    
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

        const uniqueKey = `${supplierId}-${medicine._id.toString()}`;
        
        if (!processedMedicineIds.has(uniqueKey)) {
            groupedItems[supplierId].medicines.push({
                _id: medicine._id,
                name: medicine.name,
                isUrgent: item.isUrgent || false
            });
            processedMedicineIds.add(uniqueKey);
        } else if (item.isUrgent) {
            // If duplicate medicine exists but this specific instance is urgent, mark it as urgent
            const existingMed = groupedItems[supplierId].medicines.find(m => m._id.toString() === medicine._id.toString());
            if (existingMed) existingMed.isUrgent = true;
        }
    });

    // Sort medicines within each supplier group: Urgent first
    Object.values(groupedItems).forEach(group => {
        group.medicines.sort((a, b) => (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0));
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

// @desc    Toggle item urgency
// @route   PATCH /api/requirements/item/:medicineId/urgent
export const toggleUrgent = async (req, res) => {
    try {
        const { medicineId } = req.params;
        const today = getTodayDate();

        const requirementList = await RequirementList.findOne({ date: today });

        if (requirementList) {
            const item = requirementList.items.find(
                (item) => item.medicineId.toString() === medicineId
            );
            if (item) {
                item.isUrgent = !item.isUrgent;
                await requirementList.save();
            }
        }

        // Return updated list with populated fields
        const updatedList = await RequirementList.findOne({ date: today })
            .populate({
                path: 'items.medicineId',
                populate: { path: 'supplierId', select: 'name' }
            });

        res.json(updatedList);
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

// @desc    Get Medicine Audit Data
// @route   GET /api/requirements/medicine-audit
export const getMedicineAudit = async (req, res) => {
    try {
        const { medicineId, startDate, endDate } = req.query;
        
        if (!medicineId) {
            return res.status(400).json({ message: 'Medicine ID is required' });
        }

        let query = { 'items.medicineId': medicineId };

        if (startDate && endDate) {
            const sDate = new Date(startDate);
            sDate.setHours(0,0,0,0);
            const eDate = new Date(endDate);
            eDate.setHours(23,59,59,999);
            query.createdAt = { $gte: sDate, $lte: eDate };
        }

        const requests = await PharmacistRequest.find(query)
            .populate('pharmacistId', 'username branch name')
            .sort({ createdAt: -1 });

        // Map data to return flattened results
        const results = [];
        requests.forEach(reqObj => {
            const matchedItems = reqObj.items.filter(item => item.medicineId?.toString() === medicineId);
            
            matchedItems.forEach(item => {
                results.push({
                    _id: reqObj._id,
                    branchName: reqObj.pharmacistId?.name || reqObj.pharmacistId?.username || 'Unknown Branch',
                    date: reqObj.createdAt,
                    quantity: item.quantity,
                    status: reqObj.status // Request level status
                });
            });
        });

        res.json({ data: results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// Helper: Adjust date for Dubai (UTC+4) and format it manually
// This avoids server locale issues by doing pure math on the timestamp.
const formatDubaiDate = (dateObj) => {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return String(dateObj);

    // 1. Add 4 hours to get "Dubai Wall Clock Time" as a UTC value
    // e.g. Stored: Jan 19 20:00 UTC -> +4h -> Jan 20 00:00 UTC value
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const shiftedDate = new Date(dateObj.getTime() + dubaiOffset);

    // 2. Format using UTC methods (since we shifted the value to match the desired local time)
    const day = String(shiftedDate.getUTCDate()).padStart(2, '0');
    const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = shiftedDate.getUTCFullYear();

    return `${day}/${month}/${year}`; // DD/MM/YYYY
};

const formatDubaiDateISO = (dateObj) => {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return 'report';
    
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const shiftedDate = new Date(dateObj.getTime() + dubaiOffset);
    
    const day = String(shiftedDate.getUTCDate()).padStart(2, '0');
    const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0');
    const year = shiftedDate.getUTCFullYear();

    return `${year}-${month}-${day}`; // YYYY-MM-DD
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
        
        // Fix: Use deterministic date formatting for filename
        let filenameDate = 'report';
        if (dateStr instanceof Date) {
            filenameDate = formatDubaiDateISO(dateStr);
        } else {
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

        // Helper: Draw Main Title (Only used once)
        const drawMainTitle = () => {
             doc.fontSize(20).text('Medicine Requirement List', { align: 'center' });
             
             let dateDisplay = '';
             if (dateStr instanceof Date) {
                 // Fix: Use deterministic Dubai formatting
                 dateDisplay = formatDubaiDate(dateStr);
             } else {
                 // If it's a range string, it's already formatted by the helper using locale strings.
                 // Ideally, the helper should also use our manual formatter if we wanted range fixes too,
                 // but typically ranges come from UI selection which are usually explicitly correct.
                 // For now, we trust the range string if it's already a string.
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
                const nameWidth = med.isUrgent ? 220 : 280; // Make room for URGENT label
                // Calculate height this text will take
                const nameHeight = doc.heightOfString(med.name, { width: nameWidth });
                const rowHeight = Math.max(nameHeight, 20); // At least 20px

                // Check page break with actual row height
                checkPageBreak(rowHeight + 10, info);

                const currentY = doc.y;
                
                // Print S.No
                doc.fillColor(med.isUrgent ? '#dc2626' : 'black')
                   .font(med.isUrgent ? 'Helvetica-Bold' : 'Helvetica')
                   .text(`${index + 1}`, COL_SNO, currentY);
                
                // Print Name
                doc.text(med.name, COL_NAME, currentY, { width: nameWidth });

                // Print URGENT tag
                if (med.isUrgent) {
                    doc.fontSize(10)
                       .rect(COL_NAME + nameWidth + 5, currentY, 65, 15)
                       .fill('#fee2e2');
                    
                    doc.fillColor('#991b1b')
                       .text('URGENT', COL_NAME + nameWidth + 10, currentY + 2, { width: 55, align: 'center' });
                    
                    // Reset for next lines
                    doc.fontSize(12).fillColor('black').font('Helvetica');
                }
                
                // Move cursor down by the actual height of the row
                doc.y = currentY + rowHeight + 10; // Extra padding for clarity
            });

            doc.fillColor('black'); // Ensure reset
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
