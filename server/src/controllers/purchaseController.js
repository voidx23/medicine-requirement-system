import LPO from '../models/LPO.js';
import LPOItem from '../models/LPOItem.js';
import Supplier from '../models/Supplier.js';
import Medicine from '../models/Medicine.js';
import RequirementList from '../models/RequirementList.js';
import PharmacistRequest from '../models/PharmacistRequest.js';
import SupplierDivision from '../models/SupplierDivision.js';
import SupplierMedicineStats from '../models/SupplierMedicineStats.js';

// Helper to get today's date (Dubai Midnight)
const getTodayDate = () => {
    const now = new Date();
    const utcTimestamp = now.getTime();
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const dubaiTime = new Date(utcTimestamp + dubaiOffset);
    dubaiTime.setUTCHours(0, 0, 0, 0);
    return new Date(dubaiTime.getTime() - dubaiOffset);
};

// @desc    Create a new Purchase Order (LPO)
// @route   POST /api/purchasing
// @access  Private (Admin only)
export const createPurchaseOrder = async (req, res) => {
    try {
        const { supplierId, items, notes, status, divisionId } = req.body;

        if (!supplierId) {
            return res.status(400).json({ message: 'Supplier is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'At least one item is required' });
        }

        // 1. Resolve Division ID
        let resolvedDivisionId = divisionId;
        if (!resolvedDivisionId) {
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
        }

        // 2. Generate LPO Number (LPO-YYYY-Sequential)
        const year = new Date().getFullYear();
        const count = await LPO.countDocuments();
        const lpoNumber = `LPO-${year}-${(count + 1).toString().padStart(4, '0')}`;

        // 3. Compute total amount
        let totalAmount = 0;
        items.forEach(item => {
            const qty = Number(item.quantityOrdered) || 1;
            const price = Number(item.costPrice) || 0;
            totalAmount += qty * price;
        });

        // 4. Create LPO
        const lpo = await LPO.create({
            lpoNumber,
            supplierId,
            divisionId: resolvedDivisionId,
            remarks: notes || '',
            status: status || 'draft',
            totalAmount,
            preparedBy: req.user._id,
            date: new Date()
        });

        // 5. Create LPO Items
        const formattedItems = await Promise.all(items.map(async (item) => {
            const qty = Number(item.quantityOrdered) || 1;
            const price = Number(item.costPrice) || 0;

            const lpoItem = await LPOItem.create({
                lpoId: lpo._id,
                productId: item.medicineId,
                orderQuantity: qty,
                receivedQuantity: 0,
                lastPrice: price,
                lastFoc: Number(item.lastFoc) || 0,
                remarks: item.remarks || ''
            });

            return lpoItem;
        }));

        // Populate and return combined structure
        const populatedPO = await LPO.findById(lpo._id).populate('supplierId', 'name');
        
        const populatedItems = await LPOItem.find({ lpoId: lpo._id })
            .populate('productId', 'name barcode costPrice');

        const clientItems = populatedItems.map(it => ({
            _id: it._id,
            medicineId: it.productId,
            quantityOrdered: it.orderQuantity,
            quantityReceived: it.receivedQuantity,
            costPrice: it.lastPrice
        }));

        res.status(201).json({
            ...populatedPO.toObject(),
            items: clientItems
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all Purchase Orders
// @route   GET /api/purchasing
// @access  Private
export const getPurchaseOrders = async (req, res) => {
    try {
        let query = {};
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.supplierId && req.query.supplierId !== 'all') {
            query.supplierId = req.query.supplierId;
        }

        const lpos = await LPO.find(query)
            .populate('supplierId', 'name')
            .sort({ createdAt: -1 });

        const populatedLPOs = await Promise.all(lpos.map(async (lpo) => {
            const items = await LPOItem.find({ lpoId: lpo._id })
                .populate('productId', 'name costPrice');

            const formattedItems = items.map(item => ({
                _id: item._id,
                medicineId: item.productId,
                quantityOrdered: item.orderQuantity,
                quantityReceived: item.receivedQuantity,
                costPrice: item.lastPrice
            }));

            // Map keys to match legacy PO page expectation
            return {
                ...lpo.toObject(),
                poNumber: lpo.lpoNumber,
                orderedAt: lpo.date,
                items: formattedItems
            };
        }));

        res.json(populatedLPOs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Purchase Order by ID
// @route   GET /api/purchasing/:id
// @access  Private
export const getPurchaseOrderById = async (req, res) => {
    try {
        const lpo = await LPO.findById(req.params.id)
            .populate('supplierId', 'name crNo');

        if (!lpo) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        const items = await LPOItem.find({ lpoId: lpo._id })
            .populate('productId', 'name barcode costPrice unitsPerBox');

        const formattedItems = items.map(item => ({
            _id: item._id,
            medicineId: item.productId,
            quantityOrdered: item.orderQuantity,
            quantityReceived: item.receivedQuantity,
            costPrice: item.lastPrice
        }));

        const invoices = await PurchaseInvoice.find({ lpoId: lpo._id })
            .select('invoiceNumber invoiceDate totalAmount invoiceFile');

        res.json({
            ...lpo.toObject(),
            poNumber: lpo.lpoNumber,
            orderedAt: lpo.date,
            notes: lpo.remarks,
            items: formattedItems,
            invoices
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a Purchase Order
// @route   PUT /api/purchasing/:id
// @access  Private (Admin only)
export const updatePurchaseOrder = async (req, res) => {
    try {
        const { supplierId, items, notes, status, divisionId } = req.body;
        const lpo = await LPO.findById(req.params.id);

        if (!lpo) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (lpo.status !== 'draft' && status !== 'cancelled' && lpo.status !== status) {
            if (status) {
                lpo.status = status;
                if (status === 'ordered') {
                    lpo.date = new Date();
                }
                const saved = await lpo.save();
                return res.json({
                    ...saved.toObject(),
                    poNumber: saved.lpoNumber,
                    orderedAt: saved.date,
                    notes: saved.remarks,
                    items: []
                });
            }
            return res.status(400).json({ message: 'Cannot edit items on non-draft Purchase Orders' });
        }

        if (supplierId) lpo.supplierId = supplierId;
        if (notes !== undefined) lpo.remarks = notes;
        if (status) {
            lpo.status = status;
            if (status === 'ordered') {
                lpo.date = new Date();
            }
        }
        if (divisionId) lpo.divisionId = divisionId;

        if (items && Array.isArray(items)) {
            // Delete old items and rewrite
            await LPOItem.deleteMany({ lpoId: lpo._id });

            let totalAmount = 0;
            const newItems = await Promise.all(items.map(async (item) => {
                const qty = Number(item.quantityOrdered) || 1;
                const price = Number(item.costPrice) || 0;
                totalAmount += qty * price;

                return await LPOItem.create({
                    lpoId: lpo._id,
                    productId: item.medicineId,
                    orderQuantity: qty,
                    receivedQuantity: item.quantityReceived || 0,
                    lastPrice: price
                });
            }));
            lpo.totalAmount = totalAmount;
        }

        const updatedLPO = await lpo.save();
        const populatedPO = await LPO.findById(updatedLPO._id).populate('supplierId', 'name');
        
        const populatedItems = await LPOItem.find({ lpoId: updatedLPO._id })
            .populate('productId', 'name barcode costPrice');

        const formattedItems = populatedItems.map(item => ({
            _id: item._id,
            medicineId: item.productId,
            quantityOrdered: item.orderQuantity,
            quantityReceived: item.receivedQuantity,
            costPrice: item.lastPrice
        }));

        res.json({
            ...populatedPO.toObject(),
            poNumber: populatedPO.lpoNumber,
            orderedAt: populatedPO.date,
            notes: populatedPO.remarks,
            items: formattedItems
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Receive items in a Purchase Order
// @route   PUT /api/purchasing/:id/receive
// @access  Private (Admin only)
export const receivePurchaseOrder = async (req, res) => {
    try {
        const { items } = req.body; // Expect array of { _id, quantityReceived }
        const lpo = await LPO.findById(req.params.id);

        if (!lpo) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (lpo.status !== 'ordered' && lpo.status !== 'partially_received') {
            return res.status(400).json({ message: 'Can only receive items on Ordered or Partially Received POs' });
        }

        if (items && Array.isArray(items)) {
            await Promise.all(items.map(async (updateItem) => {
                const item = await LPOItem.findById(updateItem._id);
                if (item) {
                    item.receivedQuantity = Number(updateItem.quantityReceived) || 0;
                    await item.save();
                }
            }));
        }

        // Compute status based on updated LPOItems
        const allItems = await LPOItem.find({ lpoId: lpo._id });
        let allReceived = true;
        let someReceived = false;

        allItems.forEach(item => {
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
        } else {
            lpo.status = 'ordered';
        }

        const updatedLPO = await lpo.save();
        const populatedPO = await LPO.findById(updatedLPO._id).populate('supplierId', 'name');
        
        const populatedItems = await LPOItem.find({ lpoId: updatedLPO._id })
            .populate('productId', 'name barcode costPrice');

        const formattedItems = populatedItems.map(item => ({
            _id: item._id,
            medicineId: item.productId,
            quantityOrdered: item.orderQuantity,
            quantityReceived: item.receivedQuantity,
            costPrice: item.lastPrice
        }));

        res.json({
            ...populatedPO.toObject(),
            poNumber: populatedPO.lpoNumber,
            orderedAt: populatedPO.date,
            notes: populatedPO.remarks,
            items: formattedItems
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get suggested purchase orders based on today's requirements
// @route   GET /api/purchasing/suggestions
// @access  Private (Admin only)
export const suggestPOFromRequirements = async (req, res) => {
    try {
        const today = getTodayDate();
        
        // Find today's requirement list
        const reqList = await RequirementList.findOne({ date: today })
            .populate({
                path: 'items.medicineId',
                populate: { path: 'supplierId', select: 'name' }
            });

        if (!reqList || reqList.items.length === 0) {
            return res.json([]);
        }

        // Sum quantities of all pending pharmacist requests for each medicine
        const pendingRequests = await PharmacistRequest.find({ status: 'pending' });
        const pendingQtyMap = {};
        
        pendingRequests.forEach(reqObj => {
            reqObj.items.forEach(item => {
                if (item.status === 'pending') {
                    const key = item.medicineId ? item.medicineId.toString() : null;
                    if (key) {
                        pendingQtyMap[key] = (pendingQtyMap[key] || 0) + item.quantity;
                    }
                }
            });
        });

        // Group required medicines by Supplier
        const suggestionsMap = {};

        reqList.items.forEach(item => {
            const med = item.medicineId;
            if (!med || !med.supplierId) return;

            const supplier = med.supplierId;
            const supplierId = supplier._id.toString();

            if (!suggestionsMap[supplierId]) {
                suggestionsMap[supplierId] = {
                    supplier: {
                        _id: supplier._id,
                        name: supplier.name
                    },
                    items: []
                };
            }

            // Check if this medicine is already in the list
            const existingMed = suggestionsMap[supplierId].items.find(i => i.medicineId.toString() === med._id.toString());
            if (!existingMed) {
                const pendingQty = pendingQtyMap[med._id.toString()] || 0;
                let suggestedQty = pendingQty > 0 ? pendingQty : 1;
                
                if (med.unitsPerBox && med.unitsPerBox > 1 && pendingQty > 0) {
                    suggestedQty = Math.ceil(pendingQty / med.unitsPerBox);
                }

                suggestionsMap[supplierId].items.push({
                    medicineId: med._id,
                    name: med.name,
                    barcode: med.barcode,
                    costPrice: med.costPrice || 0,
                    unitsPerBox: med.unitsPerBox || 1,
                    requiredQty: pendingQty,
                    suggestedQuantity: suggestedQty
                });
            }
        });

        res.json(Object.values(suggestionsMap));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dynamic LPO panels for a supplier (Exclusive vs Multi)
// @route   GET /api/purchasing/panels/:supplierId
// @access  Private (Admin only)
export const getSupplierPanels = async (req, res) => {
    try {
        const { supplierId } = req.params;
        const supplier = await Supplier.findById(supplierId);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        // Fetch requirement items from the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const reqLists = await RequirementList.find({ date: { $gte: thirtyDaysAgo } });
        const reqMedIds = new Set();
        reqLists.forEach(list => {
            list.items.forEach(item => {
                if (item.medicineId) {
                    reqMedIds.add(item.medicineId.toString());
                }
            });
        });

        const reqMedicines = await Medicine.find({ _id: { $in: Array.from(reqMedIds) } })
            .populate('supplierId', 'name');

        if (supplier.supplierType === 'exclusive') {
            // Panel 1: Medicines whose Primary Supplier is this supplier AND require purchase
            const panel1 = reqMedicines.filter(m => m.supplierId && m.supplierId._id.toString() === supplierId);

            // Panel 2: Show all medicines whose Primary Supplier is this supplier, excluding Panel 1
            const panel1Ids = new Set(panel1.map(m => m._id.toString()));
            const allSupplierMedicines = await Medicine.find({ supplierId })
                .populate('supplierId', 'name');
            const panel2 = allSupplierMedicines.filter(m => !panel1Ids.has(m._id.toString()));

            return res.json({
                supplierType: 'exclusive',
                panel1,
                panel2
            });
        } else {
            // Multi Supplier
            // Panel 1: Show all medicines currently requiring purchase (the entire reqMedicines list)
            const panel1 = reqMedicines;

            // Panel 2: Previously ordered from this supplier (from SupplierMedicineStats)
            const stats = await SupplierMedicineStats.find({ supplierId })
                .populate({
                    path: 'medicineId',
                    populate: { path: 'supplierId', select: 'name' }
                });
            
            const panel2 = stats.map(stat => ({
                _id: stat.medicineId?._id,
                name: stat.medicineId?.name,
                barcode: stat.medicineId?.barcode,
                costPrice: stat.medicineId?.costPrice || 0,
                unitsPerBox: stat.medicineId?.unitsPerBox || 1,
                unit: stat.medicineId?.unit || 'Box',
                supplierId: stat.medicineId?.supplierId,
                stats: {
                    lastOrderedQty: stat.lastOrderedQty,
                    lastReceivedQty: stat.lastReceivedQty,
                    lastFocQty: stat.lastFocQty,
                    lastUnitCost: stat.lastUnitCost || 0,
                    lastLpoNumber: stat.lastLpoNumber,
                    lastOrderDate: stat.lastOrderDate,
                    purchaseCount: stat.purchaseCount,
                    averageFocPercent: stat.averageFocPercent
                }
            })).filter(item => item._id !== undefined); // filter out if medicine was deleted

            // Panel 3: Supplier Products - medicines whose Primary Supplier is this supplier
            // Exclude medicines already displayed in Panel 1 or Panel 2
            const panel1Ids = new Set(panel1.map(m => m._id.toString()));
            const panel2Ids = new Set(panel2.map(m => m._id.toString()));

            const allSupplierMedicines = await Medicine.find({ supplierId })
                .populate('supplierId', 'name');
            const panel3 = allSupplierMedicines.filter(m => !panel1Ids.has(m._id.toString()) && !panel2Ids.has(m._id.toString()));

            return res.json({
                supplierType: 'multi',
                panel1,
                panel2,
                panel3
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
