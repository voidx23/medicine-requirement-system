import xlsx from 'xlsx';
import PurchaseInvoice from '../models/PurchaseInvoice.js';
import LPO from '../models/LPO.js';
import LPOItem from '../models/LPOItem.js';
import SupplierMedicineStats from '../models/SupplierMedicineStats.js';
import Medicine from '../models/Medicine.js';
import PurchaseHistory from '../models/PurchaseHistory.js';
import SupplierDivision from '../models/SupplierDivision.js';
import StockImport from '../models/StockImport.js';
import Supplier from '../models/Supplier.js';

// @desc    Upload / create a new Purchase Invoice (updates LPO, stats, history, medicine)
// @route   POST /api/invoices
// @access  Private (Admin only)
// @desc    Upload / create a new Purchase Invoice (updates LPO, stats, history, medicine, stock & batches)
// @route   POST /api/invoices
// @access  Private (Admin only)
export const createInvoice = async (req, res) => {
    try {
        const { invoiceNumber, invoiceDate, lpoId, supplierId, items, totalAmount } = req.body;

        if (!invoiceNumber || !invoiceNumber.trim()) {
            return res.status(400).json({ message: 'Invoice number is required' });
        }
        if (!supplierId) {
            return res.status(400).json({ message: 'Supplier is required' });
        }

        let parsedItems = items;
        if (typeof items === 'string') {
            try {
                parsedItems = JSON.parse(items);
            } catch (err) {
                return res.status(400).json({ message: 'Invalid items format in request' });
            }
        }

        if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
            return res.status(400).json({ message: 'Invoice items are required' });
        }

        // Check if invoice number is unique
        const trimmedInvNo = invoiceNumber.trim();
        const exists = await PurchaseInvoice.findOne({ invoiceNumber: trimmedInvNo });
        if (exists) {
            return res.status(400).json({ message: `Invoice number '${trimmedInvNo}' already exists` });
        }

        // 1. Process and format invoice items
        let computedTotal = 0;
        let totalStockUnitsSum = 0;

        const formattedItems = [];
        for (const item of parsedItems) {
            const pack = item.pack !== undefined && item.pack !== '' ? Math.max(0, Number(item.pack) || 0) : Math.max(0, Number(item.quantity) || 0);
            const loose = Math.max(0, Number(item.loose) || 0);
            const foc = Math.max(0, Number(item.foc) || Number(item.focQuantity) || 0);
            const cost = Number(item.cost) !== undefined && !isNaN(Number(item.cost)) ? Number(item.cost) : (Number(item.unitCost) || 0);
            const retailRate = Math.max(0, Number(item.retailRate) || Number(item.rpSale) || 0);
            const discAmt = Math.max(0, Number(item.discAmt) || 0);
            const vatAmt = Math.max(0, Number(item.vatAmt) || 0);

            let amount = Number(item.amount);
            if (isNaN(amount) || amount === 0) {
                const qtyForCost = pack > 0 ? pack : (loose > 0 ? loose : 1);
                amount = qtyForCost * cost;
            }

            let netValue = Number(item.netValue);
            if (isNaN(netValue) || netValue === 0) {
                netValue = Math.max(0, amount - discAmt);
            }

            let netAmount = Number(item.netAmount);
            if (isNaN(netAmount) || netAmount === 0) {
                netAmount = netValue + vatAmt;
            }

            // Expiry date
            let expDateObj = item.expDate ? new Date(item.expDate) : undefined;
            if (expDateObj && isNaN(expDateObj.getTime())) {
                const parsedExp = parseExpiryDate(item.expDate);
                expDateObj = parsedExp.date;
            }

            const { normalizedUnit, parsedMultiplier } = normalizeUnitAndPack(item.unit, pack > 0 ? pack : 1);
            const totalUnitsReceived = (pack * parsedMultiplier) + loose + foc;

            formattedItems.push({
                medicineId: item.medicineId || undefined,
                code: item.barcode || item.code || '',
                product: item.product || item.name || 'Unknown Product',
                batch: item.batch || '',
                expDate: expDateObj,
                expDateFormatted: item.expDateFormatted || '',
                pack,
                loose,
                unit: normalizedUnit,
                parsedMultiplier,
                price: cost,
                foc,
                amount,
                rpSale: retailRate,
                discAmt,
                netValue,
                vatAmt,
                netAmount,
                quantity: pack > 0 ? pack : (totalUnitsReceived || 1),
                focQuantity: foc,
                unitCost: cost,
                totalCost: netAmount,
                totalUnitsReceived
            });

            computedTotal += netAmount;
            totalStockUnitsSum += totalUnitsReceived;
        }

        const finalTotal = totalAmount !== undefined && !isNaN(Number(totalAmount)) ? Number(totalAmount) : computedTotal;

        // Resolve invoice file path if uploaded
        let invoiceFile = req.file ? `/uploads/invoices/${req.file.filename}` : '';
        if (!invoiceFile && req.body.invoiceFileUrl) {
            invoiceFile = req.body.invoiceFileUrl;
        }

        // Create Invoice record
        const invoice = await PurchaseInvoice.create({
            invoiceNumber: trimmedInvNo,
            invoiceDate: invoiceDate || new Date(),
            lpoId: lpoId || undefined,
            supplierId,
            items: formattedItems,
            totalAmount: finalTotal,
            uploadedBy: req.user?._id,
            invoiceFile
        });

        // 2. Fetch parent LPO details if linked
        let lpoNumber = '';
        if (lpoId) {
            const lpo = await LPO.findById(lpoId);
            if (lpo) {
                lpoNumber = lpo.lpoNumber;

                // Update receivedQuantity for each item in the LPO
                await Promise.all(formattedItems.map(async (invItem) => {
                    if (invItem.medicineId) {
                        const lpoItem = await LPOItem.findOne({ lpoId, productId: invItem.medicineId });
                        if (lpoItem) {
                            lpoItem.receivedQuantity = (lpoItem.receivedQuantity || 0) + (invItem.pack || invItem.quantity);
                            await lpoItem.save();
                        }
                    }
                }));

                // Recalculate LPO Status
                const allLPOItems = await LPOItem.find({ lpoId });
                let allReceived = true;
                let someReceived = false;

                allLPOItems.forEach(item => {
                    if (item.receivedQuantity < item.orderQuantity) {
                        allReceived = false;
                    }
                    if (item.receivedQuantity > 0) {
                        someReceived = true;
                    }
                });

                if (allReceived) {
                    lpo.status = 'received';
                } else if (someReceived) {
                    lpo.status = 'partially_received';
                }
                await lpo.save();
            }
        }

        // 3. Resolve Supplier Division once before item processing to prevent race conditions
        let resolvedDivisionId;
        const activeDivision = await SupplierDivision.findOne({ supplierId, status: 'active' });
        if (activeDivision) {
            resolvedDivisionId = activeDivision._id;
        } else {
            // Find or create 'General' division safely
            let generalDiv = await SupplierDivision.findOne({ supplierId, divisionName: 'General' });
            if (!generalDiv) {
                try {
                    generalDiv = await SupplierDivision.create({
                        supplierId,
                        divisionName: 'General',
                        description: 'Default general division'
                    });
                } catch (divErr) {
                    if (divErr.code === 11000) {
                        generalDiv = await SupplierDivision.findOne({ supplierId, divisionName: 'General' });
                    } else {
                        throw divErr;
                    }
                }
            }
            resolvedDivisionId = generalDiv._id;
        }

        // 4. Update Medicine Master, Stock / Batch Import, Supplier Stats, and Purchase History
        await Promise.all(formattedItems.map(async (invItem) => {
            let medId = invItem.medicineId;

            // If medicineId was not passed, attempt matching by barcode or product name
            let medicine = null;
            if (medId) {
                medicine = await Medicine.findById(medId);
            } else if (invItem.code) {
                medicine = await Medicine.findOne({ barcode: invItem.code });
            } else if (invItem.product) {
                medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${escapeRegex(invItem.product)}$`, 'i') } });
            }

            if (medicine) {
                medId = medicine._id;
                let needSave = false;

                if (invItem.parsedMultiplier > 0 && medicine.unitsPerBox !== invItem.parsedMultiplier) {
                    medicine.unitsPerBox = invItem.parsedMultiplier;
                    needSave = true;
                }
                if (invItem.unit && medicine.unit !== invItem.unit) {
                    medicine.unit = invItem.unit;
                    needSave = true;
                }
                if (invItem.price > 0 && medicine.costPrice !== invItem.price) {
                    medicine.costPrice = invItem.price;
                    needSave = true;
                }
                if (invItem.rpSale > 0 && medicine.sellingPrice !== invItem.rpSale) {
                    medicine.sellingPrice = invItem.rpSale;
                    needSave = true;
                }
                if (supplierId && (!medicine.previouslySuppliedBy || !medicine.previouslySuppliedBy.some(id => id.toString() === supplierId.toString()))) {
                    medicine.previouslySuppliedBy = medicine.previouslySuppliedBy || [];
                    medicine.previouslySuppliedBy.push(supplierId);
                    needSave = true;
                }
                if (needSave) {
                    await medicine.save();
                }

                // Add to StockImport (Batches & Inventory)
                if (invItem.batch && invItem.totalUnitsReceived > 0) {
                    await StockImport.create({
                        productId: medicine._id,
                        store: 'Central Store',
                        currentQuantity: invItem.totalUnitsReceived,
                        batch: invItem.batch,
                        expiry: invItem.expDate || new Date()
                    });
                }

                // Update Supplier + Medicine Stats
                let stats = await SupplierMedicineStats.findOne({ supplierId, medicineId: medId });
                if (!stats) {
                    stats = new SupplierMedicineStats({
                        supplierId,
                        medicineId: medId,
                        purchaseCount: 0,
                        totalOrderedQty: 0,
                        totalFocQty: 0
                    });
                }

                stats.purchaseCount += 1;
                stats.lastOrderedQty = invItem.quantity;
                stats.lastReceivedQty = invItem.quantity;
                stats.lastFocQty = invItem.focQuantity;
                stats.lastUnitCost = invItem.unitCost;
                stats.lastOrderDate = invoiceDate || new Date();
                stats.totalOrderedQty += invItem.quantity;
                stats.totalFocQty += invItem.focQuantity;
                stats.lastLpoNumber = lpoNumber;
                stats.averageFocPercent = stats.totalOrderedQty > 0 ? (stats.totalFocQty / stats.totalOrderedQty) * 100 : 0;
                await stats.save();

                // Record PurchaseHistory
                await PurchaseHistory.create({
                    supplierId,
                    divisionId: resolvedDivisionId,
                    productId: medId,
                    invoiceNumber: trimmedInvNo,
                    invoiceDate: invoiceDate || new Date(),
                    quantity: invItem.totalUnitsReceived,
                    foc: invItem.focQuantity,
                    unitCost: invItem.unitCost,
                    totalCost: invItem.totalCost
                });
            }
        }));

        const responsePayload = invoice.toObject ? invoice.toObject() : { ...invoice };
        responsePayload.success = true;
        responsePayload.invoice = invoice;
        responsePayload.summary = {
            totalItemsProcessed: formattedItems.length,
            totalInvoiceValue: finalTotal,
            totalStockUnitsAdded: totalStockUnitsSum
        };

        res.status(201).json(responsePayload);
    } catch (error) {
        console.error('Failed to create purchase invoice:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all Purchase Invoices
// @route   GET /api/invoices
// @access  Private
export const getInvoices = async (req, res) => {
    try {
        const invoices = await PurchaseInvoice.find()
            .populate('supplierId', 'name')
            .populate('lpoId', 'lpoNumber')
            .populate('items.medicineId', 'name')
            .sort({ createdAt: -1 });

        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Parse uploaded Excel invoice file and return items mapped to the 16 standard columns
// @route   POST /api/invoices/parse-excel
// @access  Private (Admin only)
export const parseInvoiceExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Read Excel file
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const HEADER_MAP = {
            no: /^no\.?$|^sl\.?\s*no/i,
            product: /product(\s*name)?|item(\s*name)?|description|medicine/i,
            barcode: /barcode|item\s*code|code|sku/i,
            batch: /batch|lot/i,
            expDate: /exp(\s*date)?|expiry/i,
            pack: /^pack$|pack\s*qty/i,
            loose: /loose|loose\s*qty/i,
            unit: /^unit$|unit\s*desc/i,
            cost: /^cost$|^price$|rate|unit\s*cost/i,
            foc: /foc|free/i,
            amount: /^amount$|gross/i,
            retailRate: /retail(\s*rate)?|rp\s*sale|sale\s*price|mrp/i,
            discAmt: /disc(\s*amt)?|discount/i,
            netValue: /net\s*val(ue)?/i,
            vatAmt: /vat(\s*amt)?|vat|tax/i,
            netAmount: /net\s*am(oun)?t|total\s*net|total/i
        };

        const firstRow = rows[0];
        const keyMap = {};

        Object.keys(firstRow).forEach(columnKey => {
            const trimmedKey = columnKey.trim();
            for (const [field, regex] of Object.entries(HEADER_MAP)) {
                if (!keyMap[field] && regex.test(trimmedKey)) {
                    keyMap[field] = columnKey;
                }
            }
        });

        // Preload medicines to match fast in memory or query
        const parsedItems = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rawNo = row[keyMap.no] !== undefined && row[keyMap.no] !== '' ? row[keyMap.no] : (i + 1);
            const rawProduct = (row[keyMap.product] || '').toString().trim();
            const rawBarcode = (row[keyMap.barcode] || '').toString().trim();
            const rawBatch = (row[keyMap.batch] || '').toString().trim();
            const rawExpDate = row[keyMap.expDate];
            const rawPack = row[keyMap.pack];
            const rawLoose = row[keyMap.loose];
            const rawUnit = (row[keyMap.unit] || '').toString().trim();
            const rawCost = row[keyMap.cost];
            const rawFoc = row[keyMap.foc];
            const rawAmount = row[keyMap.amount];
            const rawRetailRate = row[keyMap.retailRate];
            const rawDiscAmt = row[keyMap.discAmt];
            const rawNetValue = row[keyMap.netValue];
            const rawVatAmt = row[keyMap.vatAmt];
            const rawNetAmount = row[keyMap.netAmount];

            if (!rawProduct && !rawBarcode) continue;

            const pack = Math.max(0, Number(rawPack) || 0);
            const loose = Math.max(0, Number(rawLoose) || 0);
            const foc = Math.max(0, Number(rawFoc) || 0);
            const cost = parsePriceValue(rawCost);
            const retailRate = Math.max(0, Number(rawRetailRate) || 0);
            const discAmt = Math.max(0, Number(rawDiscAmt) || 0);
            const vatAmt = Math.max(0, Number(rawVatAmt) || 0);

            // Calculate Amount if missing: (pack > 0 ? pack : (loose > 0 ? loose : 1)) * cost
            let amount = Number(rawAmount);
            if (isNaN(amount) || amount === 0) {
                const qtyForCost = pack > 0 ? pack : loose;
                amount = (qtyForCost > 0 ? qtyForCost : 1) * cost;
            }

            // Calculate Net Value if missing: amount - discAmt
            let netValue = Number(rawNetValue);
            if (isNaN(netValue) || netValue === 0) {
                netValue = Math.max(0, amount - discAmt);
            }

            // Calculate Net Amount if missing: netValue + vatAmt
            let netAmount = Number(rawNetAmount);
            if (isNaN(netAmount) || netAmount === 0) {
                netAmount = netValue + vatAmt;
            }

            // Expiry Date Parsing
            const { date: expDateObj, formatted: expDateFormatted } = parseExpiryDate(rawExpDate);

            // Unit & Pack Multiplier Normalization
            const { normalizedUnit, parsedMultiplier } = normalizeUnitAndPack(rawUnit, pack > 0 ? pack : 1);

            // Stock units = (pack * multiplier) + loose + foc
            const totalUnitsReceived = (pack * parsedMultiplier) + loose + foc;

            // Try to match medicine by barcode, then name
            let medicine = null;
            if (rawBarcode) {
                medicine = await Medicine.findOne({ barcode: rawBarcode });
            }
            if (!medicine && rawProduct) {
                medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${escapeRegex(rawProduct)}$`, 'i') } });
            }

            parsedItems.push({
                no: rawNo,
                medicineId: medicine ? medicine._id.toString() : null,
                product: rawProduct || (medicine ? medicine.name : 'Unknown Product'),
                barcode: rawBarcode || (medicine?.barcode || ''),
                batch: rawBatch,
                expDate: expDateObj,
                expDateFormatted,
                pack,
                loose,
                unit: normalizedUnit || medicine?.unit || 'BOX',
                parsedMultiplier,
                cost,
                foc,
                amount,
                retailRate: retailRate || (medicine?.sellingPrice || 0),
                discAmt,
                netValue,
                vatAmt,
                netAmount,
                totalUnitsReceived,
                isMatched: !!medicine
            });
        }

        res.json({
            filePath: `/uploads/invoices/${req.file.filename}`,
            items: parsedItems
        });
    } catch (error) {
        console.error('Error parsing invoice excel:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Purchase History Logs (Ledger)
// @route   GET /api/invoices/history
// @access  Private
export const getPurchaseHistory = async (req, res) => {
    try {
        let query = {};
        if (req.query.supplierId && req.query.supplierId !== 'all') {
            query.supplierId = req.query.supplierId;
        }

        const history = await PurchaseHistory.find(query)
            .populate('supplierId', 'name')
            .populate('divisionId', 'divisionName')
            .populate('productId', 'name barcode costPrice')
            .sort({ invoiceDate: -1, createdAt: -1 });

        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper 1: Parse Price Value ("Free" -> 0.00)
export const parsePriceValue = (val) => {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    if (/free/i.test(str)) return 0;
    const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
};

// Helper 2: Parse Expiry Date to DD-MM-YYYY string and Date object
export const parseExpiryDate = (val) => {
    if (!val) return { date: new Date(), formatted: '' };

    let dateObj = null;

    if (typeof val === 'number') {
        // Excel serial date code
        const parsed = xlsx.SSF.parse_date_code(val);
        if (parsed) {
            dateObj = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
        }
    } else if (val instanceof Date) {
        dateObj = val;
    } else {
        const str = String(val).trim();
        // Check DD-MM-YYYY or DD/MM/YYYY
        const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (ddmmyyyy) {
            const day = parseInt(ddmmyyyy[1], 10);
            const month = parseInt(ddmmyyyy[2], 10) - 1;
            const year = parseInt(ddmmyyyy[3], 10);
            dateObj = new Date(Date.UTC(year, month, day));
        } else {
            const parsedTs = Date.parse(str);
            if (!isNaN(parsedTs)) {
                dateObj = new Date(parsedTs);
            }
        }
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
        dateObj = new Date();
    }

    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const year = dateObj.getUTCFullYear();
    const formatted = `${day}-${month}-${year}`;

    return { date: dateObj, formatted };
};

// Helper 3: Normalize Unit & Pack Descriptors and extract Multiplier
export const normalizeUnitAndPack = (unitStr, packVal) => {
    let rawUnit = (unitStr || '').toString().trim();
    let parsedMultiplier = 1;

    // Apply regex cleaning: (?i)box\s*-\s*(\d+)
    const boxMatch = rawUnit.match(/box\s*-\s*(\d+)/i);
    if (boxMatch) {
        const size = parseInt(boxMatch[1], 10);
        rawUnit = `BOX-${size}`;
        parsedMultiplier = size > 0 ? size : 1;
    } else if (/^nos00$/i.test(rawUnit)) {
        rawUnit = 'NOS00';
        parsedMultiplier = 100;
    } else if (/^nos0$/i.test(rawUnit)) {
        rawUnit = 'NOS0';
        parsedMultiplier = 10;
    } else if (/^nos$/i.test(rawUnit)) {
        rawUnit = 'NOS';
        parsedMultiplier = 1;
    } else {
        const packNum = Number(packVal);
        if (!isNaN(packNum) && packNum > 1) {
            parsedMultiplier = packNum;
        }
    }

    return { normalizedUnit: rawUnit || 'BOX', parsedMultiplier };
};

// @desc    Upload Excel invoice (.xlsx, .xls), process fuzzy headers, clean edge cases, bulk save header + items & update stock
// @route   POST /api/invoices/upload-excel
// @access  Private (Admin only)
export const uploadAndProcessExcelInvoice = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No Excel file uploaded' });
        }

        const { invoiceNumber, invoiceDate, supplierId, lpoId } = req.body;

        // Read workbook
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        // Standard header map regexes
        const HEADER_MAP = {
            no: /^no\.?$|^sl\.?\s*no/i,
            product: /product|item|description|name/i,
            code: /code|barcode|sku/i,
            batch: /batch|lot/i,
            expDate: /exp\s*date|expiry|exp/i,
            pack: /^pack$|pack\s*qty/i,
            loose: /loose|loose\s*qty/i,
            unit: /^unit$|unit\s*desc/i,
            price: /^price$|cost|rate/i,
            foc: /foc|free/i,
            amount: /^amount$|gross/i,
            rpSale: /rp\s*sale|retail|sale\s*price|mrp/i,
            discAmt: /disc\s*amt|discount/i,
            netValue: /net\s*val|net\s*value/i,
            vatAmt: /vat\s*amt|vat|tax/i,
            netAmount: /net\s*amt|net\s*amount|total\s*net/i
        };

        const firstRow = rows[0];
        const keyMap = {};

        Object.keys(firstRow).forEach(columnKey => {
            const trimmedKey = columnKey.trim();
            for (const [field, regex] of Object.entries(HEADER_MAP)) {
                if (!keyMap[field] && regex.test(trimmedKey)) {
                    keyMap[field] = columnKey;
                }
            }
        });

        // Resolve supplier
        let resolvedSupplierId = supplierId;
        if (!resolvedSupplierId) {
            const firstSupplier = await Supplier.findOne();
            resolvedSupplierId = firstSupplier ? firstSupplier._id : undefined;
        }

        // Resolve invoice number
        const resolvedInvNumber = invoiceNumber && invoiceNumber.trim() ? invoiceNumber.trim() : `INV-${Date.now()}`;

        // Check if invoice number already exists
        const existingInvoice = await PurchaseInvoice.findOne({ invoiceNumber: resolvedInvNumber });
        if (existingInvoice) {
            return res.status(400).json({ message: `Invoice number '${resolvedInvNumber}' already exists` });
        }

        const processedItems = [];
        const errorLogs = [];
        let totalInvoiceNetSum = 0;
        let totalStockUnitsSum = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 1;

            try {
                const rawProduct = row[keyMap.product]?.toString().trim() || '';
                const rawCode = row[keyMap.code]?.toString().trim() || '';
                const rawBatch = row[keyMap.batch]?.toString().trim() || '';
                const rawExpDate = row[keyMap.expDate];
                const rawPack = row[keyMap.pack];
                const rawLoose = row[keyMap.loose];
                const rawUnit = row[keyMap.unit]?.toString().trim() || '';
                const rawPrice = row[keyMap.price];
                const rawFoc = row[keyMap.foc];
                const rawAmount = row[keyMap.amount];
                const rawRpSale = row[keyMap.rpSale];
                const rawDiscAmt = row[keyMap.discAmt];
                const rawNetValue = row[keyMap.netValue];
                const rawVatAmt = row[keyMap.vatAmt];
                const rawNetAmount = row[keyMap.netAmount];

                if (!rawProduct && !rawCode) continue;

                // Numeric coercion
                const pack = Math.max(0, Number(rawPack) || 0);
                const loose = Math.max(0, Number(rawLoose) || 0);
                const foc = Math.max(0, Number(rawFoc) || 0);
                const price = parsePriceValue(rawPrice);
                const amount = Math.max(0, Number(rawAmount) || 0);
                const rpSale = Math.max(0, Number(rawRpSale) || 0);
                const discAmt = Math.max(0, Number(rawDiscAmt) || 0);
                const netValue = Math.max(0, Number(rawNetValue) || 0);
                const vatAmt = Math.max(0, Number(rawVatAmt) || 0);
                let netAmount = Number(rawNetAmount);
                if (isNaN(netAmount) || netAmount <= 0) {
                    netAmount = netValue > 0 ? netValue + vatAmt : (amount - discAmt + vatAmt);
                }
                netAmount = Math.max(0, netAmount);

                // Date Parsing to DD-MM-YYYY & Date Object
                const { date: expDateObj, formatted: expDateFormatted } = parseExpiryDate(rawExpDate);

                // Unit & Pack Normalization & Multiplier Extraction
                const { normalizedUnit, parsedMultiplier } = normalizeUnitAndPack(rawUnit, pack > 0 ? pack : 1);

                // Total Stock Added = (Pack * Multiplier) + Loose + FOC
                const totalUnitsReceived = (pack * parsedMultiplier) + loose + foc;

                // Match Medicine in DB
                let medicine = null;
                if (rawCode) {
                    medicine = await Medicine.findOne({ barcode: rawCode });
                }
                if (!medicine && rawProduct) {
                    medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${escapeRegex(rawProduct)}$`, 'i') } });
                }

                if (medicine) {
                    let needSave = false;
                    if (parsedMultiplier > 0 && medicine.unitsPerBox !== parsedMultiplier) {
                        medicine.unitsPerBox = parsedMultiplier;
                        needSave = true;
                    }
                    if (normalizedUnit && medicine.unit !== normalizedUnit) {
                        medicine.unit = normalizedUnit;
                        needSave = true;
                    }
                    if (price > 0 && medicine.costPrice !== price) {
                        medicine.costPrice = price;
                        needSave = true;
                    }
                    if (rpSale > 0 && medicine.sellingPrice !== rpSale) {
                        medicine.sellingPrice = rpSale;
                        needSave = true;
                    }
                    if (resolvedSupplierId && (!medicine.previouslySuppliedBy || !medicine.previouslySuppliedBy.some(id => id.toString() === resolvedSupplierId.toString()))) {
                        medicine.previouslySuppliedBy = medicine.previouslySuppliedBy || [];
                        medicine.previouslySuppliedBy.push(resolvedSupplierId);
                        needSave = true;
                    }
                    if (needSave) {
                        await medicine.save();
                    }

                    if (rawBatch && totalUnitsReceived > 0) {
                        await StockImport.create({
                            productId: medicine._id,
                            store: 'Central Store',
                            currentQuantity: totalUnitsReceived,
                            batch: rawBatch,
                            expiry: expDateObj
                        });
                    }
                } else {
                    errorLogs.push({ row: rowNum, product: rawProduct, code: rawCode, message: 'Medicine not found in database master record.' });
                }

                processedItems.push({
                    medicineId: medicine ? medicine._id : undefined,
                    code: rawCode,
                    product: rawProduct || (medicine ? medicine.name : 'Unknown Product'),
                    batch: rawBatch,
                    expDate: expDateObj,
                    expDateFormatted,
                    pack,
                    loose,
                    unit: normalizedUnit,
                    parsedMultiplier,
                    price,
                    foc,
                    amount,
                    rpSale,
                    discAmt,
                    netValue,
                    vatAmt,
                    netAmount,
                    quantity: pack > 0 ? pack : (totalUnitsReceived || 1),
                    focQuantity: foc,
                    unitCost: price,
                    totalCost: netAmount,
                    totalUnitsReceived
                });

                totalInvoiceNetSum += netAmount;
                totalStockUnitsSum += totalUnitsReceived;

            } catch (rowErr) {
                errorLogs.push({ row: rowNum, message: rowErr.message });
            }
        }

        if (processedItems.length === 0) {
            return res.status(400).json({ message: 'No valid invoice items were parsed from Excel file', errorLogs });
        }

        // Create Header PurchaseInvoice Record
        const invoiceHeader = await PurchaseInvoice.create({
            invoiceNumber: resolvedInvNumber,
            invoiceDate: invoiceDate || new Date(),
            supplierId: resolvedSupplierId,
            lpoId: lpoId || undefined,
            items: processedItems,
            totalAmount: totalInvoiceNetSum,
            uploadedBy: req.user?._id,
            invoiceFile: `/uploads/invoices/${req.file.filename}`
        });

        // Resolve division once
        let resolvedDivisionId;
        if (resolvedSupplierId) {
            const activeDivision = await SupplierDivision.findOne({ supplierId: resolvedSupplierId, status: 'active' });
            if (activeDivision) {
                resolvedDivisionId = activeDivision._id;
            } else {
                let generalDiv = await SupplierDivision.findOne({ supplierId: resolvedSupplierId, divisionName: 'General' });
                if (!generalDiv) {
                    try {
                        generalDiv = await SupplierDivision.create({
                            supplierId: resolvedSupplierId,
                            divisionName: 'General',
                            description: 'Default general division'
                        });
                    } catch (divErr) {
                        if (divErr.code === 11000) {
                            generalDiv = await SupplierDivision.findOne({ supplierId: resolvedSupplierId, divisionName: 'General' });
                        } else {
                            throw divErr;
                        }
                    }
                }
                resolvedDivisionId = generalDiv._id;
            }
        }

        // Insert PurchaseHistory records for matched medicines
        await Promise.all(processedItems.map(async (item) => {
            if (item.medicineId && resolvedSupplierId) {
                await PurchaseHistory.create({
                    supplierId: resolvedSupplierId,
                    divisionId: resolvedDivisionId,
                    productId: item.medicineId,
                    invoiceNumber: resolvedInvNumber,
                    invoiceDate: invoiceDate || new Date(),
                    quantity: item.totalUnitsReceived,
                    foc: item.foc,
                    unitCost: item.price,
                    totalCost: item.netAmount
                });
            }
        }));

        res.status(201).json({
            success: true,
            invoice: invoiceHeader,
            summary: {
                totalItemsProcessed: processedItems.length,
                totalInvoiceValue: totalInvoiceNetSum,
                totalStockUnitsAdded: totalStockUnitsSum,
                errorLogs
            }
        });
    } catch (error) {
        console.error('Failed to process Excel invoice', error);
        res.status(500).json({ message: error.message });
    }
};

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
