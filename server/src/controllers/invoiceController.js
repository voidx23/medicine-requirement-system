import xlsx from 'xlsx';
import PurchaseInvoice from '../models/PurchaseInvoice.js';
import LPO from '../models/LPO.js';
import LPOItem from '../models/LPOItem.js';
import SupplierMedicineStats from '../models/SupplierMedicineStats.js';
import Medicine from '../models/Medicine.js';
import PurchaseHistory from '../models/PurchaseHistory.js';
import SupplierDivision from '../models/SupplierDivision.js';

// @desc    Upload / create a new Purchase Invoice (updates LPO, stats, history, medicine)
// @route   POST /api/invoices
// @access  Private (Admin only)
export const createInvoice = async (req, res) => {
    try {
        const { invoiceNumber, invoiceDate, lpoId, supplierId, items, totalAmount } = req.body;

        if (!invoiceNumber) {
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
        const exists = await PurchaseInvoice.findOne({ invoiceNumber });
        if (exists) {
            return res.status(400).json({ message: `Invoice number '${invoiceNumber}' already exists` });
        }

        // 1. Create invoice items payload
        const formattedItems = parsedItems.map(item => ({
            medicineId: item.medicineId,
            quantity: Number(item.quantity) || 1,
            focQuantity: Number(item.focQuantity) || 0,
            unitCost: Number(item.unitCost) || 0,
            totalCost: (Number(item.quantity) || 1) * (Number(item.unitCost) || 0)
        }));

        // Compute total amount if not explicitly provided
        const computedTotal = formattedItems.reduce((sum, item) => sum + item.totalCost, 0);
        const finalTotal = totalAmount !== undefined ? Number(totalAmount) : computedTotal;

        // Resolve invoice file path if uploaded
        let invoiceFile = req.file ? `/uploads/invoices/${req.file.filename}` : '';
        if (!invoiceFile && req.body.invoiceFileUrl) {
            invoiceFile = req.body.invoiceFileUrl;
        }

        // Create Invoice record
        const invoice = await PurchaseInvoice.create({
            invoiceNumber,
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
                    const lpoItem = await LPOItem.findOne({ lpoId, productId: invItem.medicineId });
                    if (lpoItem) {
                        lpoItem.receivedQuantity = (lpoItem.receivedQuantity || 0) + invItem.quantity;
                        await lpoItem.save();
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

        // 3. Update Supplier Learning, Medicine Supply History, and create PurchaseHistory
        await Promise.all(formattedItems.map(async (invItem) => {
            const medId = invItem.medicineId;

            // A. Update Supplier + Medicine Stats (FOC learning, count, averages)
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
            stats.lastOrderedQty = invItem.quantity; // default to invoice quantity
            stats.lastReceivedQty = invItem.quantity;
            stats.lastFocQty = invItem.focQuantity;
            stats.lastUnitCost = invItem.unitCost;
            stats.lastOrderDate = invoiceDate || new Date();
            stats.totalOrderedQty += invItem.quantity;
            stats.totalFocQty += invItem.focQuantity;
            stats.lastLpoNumber = lpoNumber;

            // Calculate FOC %
            stats.averageFocPercent = stats.totalOrderedQty > 0 ? (stats.totalFocQty / stats.totalOrderedQty) * 100 : 0;
            await stats.save();

            // B. Add supplier to Medicine's previouslySuppliedBy set
            await Medicine.findByIdAndUpdate(medId, {
                $addToSet: { previouslySuppliedBy: supplierId }
            });

            // C. Resolve Division ID and create PurchaseHistory
            let resolvedDivisionId;
            const divisions = await SupplierDivision.find({ supplierId, status: 'active' });
            if (divisions.length > 0) {
                resolvedDivisionId = divisions[0]._id;
            } else {
                const defaultDiv = await SupplierDivision.create({
                    supplierId,
                    divisionName: 'General',
                    description: 'Default general division'
                });
                resolvedDivisionId = defaultDiv._id;
            }

            await PurchaseHistory.create({
                supplierId,
                divisionId: resolvedDivisionId,
                productId: medId,
                invoiceNumber,
                invoiceDate: invoiceDate || new Date(),
                quantity: invItem.quantity,
                foc: invItem.focQuantity,
                unitCost: invItem.unitCost,
                totalCost: invItem.totalCost
            });
        }));

        res.status(201).json(invoice);
    } catch (error) {
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

// @desc    Parse uploaded Excel invoice file and return matched medicines list
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
        const rows = xlsx.utils.sheet_to_json(sheet);

        const parsedItems = [];

        for (const row of rows) {
            // Find key headers case-insensitively
            const barcodeKey = Object.keys(row).find(k => /barcode|item\s*code|code/i.test(k));
            const nameKey = Object.keys(row).find(k => /name|medicine|description|product/i.test(k));
            const qtyKey = Object.keys(row).find(k => /qty|quantity|invoice\s*qty|billed/i.test(k));
            const focKey = Object.keys(row).find(k => /foc|free/i.test(k));
            const costKey = Object.keys(row).find(k => /cost|price|rate/i.test(k));

            const barcode = row[barcodeKey]?.toString().trim() || '';
            const name = row[nameKey]?.toString().trim() || '';
            const quantity = Number(row[qtyKey]) || 0;
            const focQuantity = Number(row[focKey]) || 0;
            const unitCost = Number(row[costKey]) || 0;

            if (!barcode && !name) continue;

            // Find medicine in database by barcode or name
            let medicine = null;
            if (barcode) {
                medicine = await Medicine.findOne({ barcode });
            }
            if (!medicine && name) {
                medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } });
            }

            if (medicine) {
                parsedItems.push({
                    medicineId: medicine._id.toString(),
                    name: medicine.name,
                    barcode: medicine.barcode || '',
                    quantity,
                    focQuantity,
                    unitCost
                });
            } else {
                parsedItems.push({
                    medicineId: null,
                    name: name || `Unknown (${barcode})`,
                    barcode,
                    quantity,
                    focQuantity,
                    unitCost,
                    unresolved: true
                });
            }
        }

        res.json({
            filePath: `/uploads/invoices/${req.file.filename}`,
            items: parsedItems
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
