import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import Medicine from '../models/Medicine.js';
import RequirementList from '../models/RequirementList.js';
import PharmacistRequest from '../models/PharmacistRequest.js';

// Helper to get today's date (Dubai Midnight)
const getTodayDate = () => {
    const now = new Date();
    const utcTimestamp = now.getTime();
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const dubaiTime = new Date(utcTimestamp + dubaiOffset);
    dubaiTime.setUTCHours(0, 0, 0, 0);
    return new Date(dubaiTime.getTime() - dubaiOffset);
};

// @desc    Create a new Purchase Order
// @route   POST /api/purchasing
// @access  Private (Admin only)
export const createPurchaseOrder = async (req, res) => {
    try {
        const { supplierId, items, notes, status } = req.body;

        if (!supplierId) {
            return res.status(400).json({ message: 'Supplier is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'At least one item is required' });
        }

        // Generate PO Number (PO-YYYY-Sequential)
        const year = new Date().getFullYear();
        const count = await PurchaseOrder.countDocuments();
        const poNumber = `PO-${year}-${(count + 1).toString().padStart(4, '0')}`;

        // Compute total amount
        let totalAmount = 0;
        const formattedItems = items.map(item => {
            const qty = Number(item.quantityOrdered) || 1;
            const price = Number(item.costPrice) || 0;
            totalAmount += qty * price;
            return {
                medicineId: item.medicineId,
                quantityOrdered: qty,
                costPrice: price,
                quantityReceived: 0
            };
        });

        const purchaseOrder = await PurchaseOrder.create({
            poNumber,
            supplierId,
            items: formattedItems,
            totalAmount,
            notes: notes || '',
            status: status || 'draft',
            orderedAt: status === 'ordered' ? new Date() : null
        });

        const populatedPO = await PurchaseOrder.findById(purchaseOrder._id)
            .populate('supplierId', 'name')
            .populate('items.medicineId', 'name barcode costPrice');

        res.status(201).json(populatedPO);
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

        const purchaseOrders = await PurchaseOrder.find(query)
            .populate('supplierId', 'name')
            .populate('items.medicineId', 'name costPrice')
            .sort({ createdAt: -1 });

        res.json(purchaseOrders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Purchase Order by ID
// @route   GET /api/purchasing/:id
// @access  Private
export const getPurchaseOrderById = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id)
            .populate('supplierId', 'name crNo')
            .populate('items.medicineId', 'name barcode costPrice unitsPerBox');

        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        res.json(po);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a Purchase Order
// @route   PUT /api/purchasing/:id
// @access  Private (Admin only)
export const updatePurchaseOrder = async (req, res) => {
    try {
        const { supplierId, items, notes, status } = req.body;
        const po = await PurchaseOrder.findById(req.params.id);

        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (po.status !== 'draft' && status !== 'cancelled' && po.status !== status) {
            // Cannot edit items if not in draft
            // But can transit ordered -> cancelled
            if (status) {
                po.status = status;
                if (status === 'ordered' && !po.orderedAt) {
                    po.orderedAt = new Date();
                }
                const saved = await po.save();
                return res.json(saved);
            }
            return res.status(400).json({ message: 'Cannot edit items on non-draft Purchase Orders' });
        }

        if (supplierId) po.supplierId = supplierId;
        if (notes !== undefined) po.notes = notes;
        if (status) {
            po.status = status;
            if (status === 'ordered' && !po.orderedAt) {
                po.orderedAt = new Date();
            }
        }

        if (items && Array.isArray(items)) {
            let totalAmount = 0;
            po.items = items.map(item => {
                const qty = Number(item.quantityOrdered) || 1;
                const price = Number(item.costPrice) || 0;
                totalAmount += qty * price;
                return {
                    medicineId: item.medicineId,
                    quantityOrdered: qty,
                    costPrice: price,
                    quantityReceived: item.quantityReceived || 0
                };
            });
            po.totalAmount = totalAmount;
        }

        const updatedPO = await po.save();
        const populatedPO = await PurchaseOrder.findById(updatedPO._id)
            .populate('supplierId', 'name')
            .populate('items.medicineId', 'name barcode costPrice');

        res.json(populatedPO);
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
        const po = await PurchaseOrder.findById(req.params.id);

        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (po.status !== 'ordered' && po.status !== 'partially_received') {
            return res.status(400).json({ message: 'Can only receive items on Ordered or Partially Received POs' });
        }

        if (items && Array.isArray(items)) {
            items.forEach(updateItem => {
                const item = po.items.id(updateItem._id);
                if (item) {
                    item.quantityReceived = Number(updateItem.quantityReceived) || 0;
                }
            });
        }

        // Compute status
        let allReceived = true;
        let someReceived = false;

        po.items.forEach(item => {
            if (item.quantityReceived < item.quantityOrdered) {
                allReceived = false;
            }
            if (item.quantityReceived > 0) {
                someReceived = true;
            }
        });

        if (allReceived) {
            po.status = 'received';
            po.receivedAt = new Date();
        } else if (someReceived) {
            po.status = 'partially_received';
        } else {
            po.status = 'ordered';
        }

        const updatedPO = await po.save();
        const populatedPO = await PurchaseOrder.findById(updatedPO._id)
            .populate('supplierId', 'name')
            .populate('items.medicineId', 'name barcode costPrice');

        res.json(populatedPO);
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
                // Determine suggested quantity: pending requests sum, or fallback to unitsPerBox or 1
                const pendingQty = pendingQtyMap[med._id.toString()] || 0;
                let suggestedQty = pendingQty > 0 ? pendingQty : 1;
                
                // If unitsPerBox is set, suggest ordering in full boxes (ceiling division)
                if (med.unitsPerBox && med.unitsPerBox > 1 && pendingQty > 0) {
                    suggestedQty = Math.ceil(pendingQty / med.unitsPerBox);
                }

                suggestionsMap[supplierId].items.push({
                    medicineId: med._id,
                    name: med.name,
                    barcode: med.barcode,
                    costPrice: med.costPrice || 0,
                    unitsPerBox: med.unitsPerBox || 1,
                    requiredQty: pendingQty, // raw quantity needed by branches
                    suggestedQuantity: suggestedQty // in boxes
                });
            }
        });

        res.json(Object.values(suggestionsMap));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
