import ExpiryReturn from '../models/ExpiryReturn.js';
import Medicine from '../models/Medicine.js';
import SupplierExpiryLedger from '../models/SupplierExpiryLedger.js';
import Notification from '../models/Notification.js';

// --- PHARMACIST ROUTES ---

// @desc    Create a new Expiry Return (Draft or Submitted)
// @route   POST /api/expiry
// @access  Private (Pharmacist)
export const createExpiryReturn = async (req, res) => {
    try {
        const { month, year, items, status } = req.body;
        
        // Prevent duplicate list for the same month/year per branch if it's already submitted
        const existing = await ExpiryReturn.findOne({ branchId: req.user._id, month, year });
        if (existing && existing.status !== 'Draft') {
            return res.status(400).json({ message: `You have already submitted an expiry list for ${month}/${year}` });
        }

        let expiryList = existing;

        if (expiryList) {
            expiryList.items = items;
            expiryList.status = status || 'Draft';
            if (status === 'Submitted') expiryList.submittedAt = new Date();
            await expiryList.save();
        } else {
            expiryList = await ExpiryReturn.create({
                branchId: req.user._id,
                month,
                year,
                items,
                status: status || 'Draft',
                submittedAt: status === 'Submitted' ? new Date() : null
            });
        }

        res.status(201).json(expiryList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get branch expiry returns
// @route   GET /api/expiry/my-returns
// @access  Private (Pharmacist)
export const getMyExpiryReturns = async (req, res) => {
    try {
        const returns = await ExpiryReturn.find({ branchId: req.user._id })
            .populate('items.medicineId', 'name barcode')
            .sort({ year: -1, month: -1 });
        res.json(returns);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// --- ADMIN STORE VERIFICATION ROUTES ---

// @desc    Get all submitted/verified expiry returns
// @route   GET /api/expiry
// @access  Private (Admin)
export const getAllExpiryReturns = async (req, res) => {
    try {
        const returns = await ExpiryReturn.find({ status: { $ne: 'Draft' } })
            .populate('branchId', 'name')
            .populate('items.medicineId', 'name barcode supplierId costPrice')
            .sort({ submittedAt: -1 });
        res.json(returns);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify and check off items in an Expiry Return
// @route   PUT /api/expiry/:id/verify
// @access  Private (Admin)
export const verifyExpiryReturn = async (req, res) => {
    try {
        const { items, storeNote } = req.body;
        const expiryList = await ExpiryReturn.findById(req.params.id)
            .populate('items.medicineId');

        if (!expiryList) return res.status(404).json({ message: 'List not found' });
        if (expiryList.status === 'Verified') return res.status(400).json({ message: 'Already verified' });

        let anyChanges = false;
        if (storeNote && storeNote !== expiryList.storeNote) {
            expiryList.storeNote = storeNote;
            anyChanges = true;
        }

        // Map incoming items array to the list
        // Items must contain: medicineId, qtyReceived, isNonReturnable
        const verifiedItems = [];
        for (const item of items) {
            // Need to take a snapshot of the cost price right now
            const med = await Medicine.findById(item.medicineId);
            if (!med) continue;

            verifiedItems.push({
                medicineId: item.medicineId,
                qtySent: item.qtySent || 0,
                qtyReceived: item.qtyReceived,
                isNonReturnable: item.isNonReturnable || false,
                costPriceAtReturn: med.costPrice || 0
            });
            
            // Check if qty changed from what was sent
            if (item.qtySent !== item.qtyReceived) anyChanges = true;
        }

        expiryList.items = verifiedItems;
        expiryList.status = 'Verified';
        expiryList.verifiedAt = new Date();

        await expiryList.save();

        // Update the Supplier Ledgers
        for (const item of verifiedItems) {
            if (item.isNonReturnable) continue; // Disposed, doesn't go to supplier
            
            const med = await Medicine.findById(item.medicineId);
            if (!med || !med.supplierId) continue;
            
            const itemValue = item.qtyReceived * (med.costPrice || 0);
            if (itemValue <= 0) continue;

            let ledger = await SupplierExpiryLedger.findOne({
                supplierId: med.supplierId,
                month: expiryList.month,
                year: expiryList.year
            });

            if (!ledger) {
                ledger = new SupplierExpiryLedger({
                    supplierId: med.supplierId,
                    month: expiryList.month,
                    year: expiryList.year,
                    totalValueHandedOver: itemValue
                });
            } else {
                ledger.totalValueHandedOver += itemValue;
            }
            await ledger.save();
        }

        // Notify pharmacist
        await Notification.create({
            userId: expiryList.branchId,
            title: 'Expiry List Verified',
            message: `The Store has verified your ${expiryList.month}/${expiryList.year} expiry list.` + (storeNote ? ' They added a note.' : (anyChanges ? ' Some quantities were adjusted.' : '')),
            link: '/expiry-returns'
        });

        res.json(expiryList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- ADMIN SUPPLIER LEDGER ROUTES ---

// @desc    Get aggregated supplier ledgers
// @route   GET /api/expiry/ledgers
// @access  Private (Admin)
export const getSupplierLedgers = async (req, res) => {
    try {
        const { supplierId, year, months } = req.query; // months should be comma separated like "1,2,3"
        
        let query = {};
        if (supplierId) query.supplierId = supplierId;
        if (year) query.year = parseInt(year);
        if (months) {
            const mArr = months.split(',').map(m => parseInt(m));
            query.month = { $in: mArr };
        }

        const ledgers = await SupplierExpiryLedger.find(query)
            .populate('supplierId', 'name')
            .sort({ year: -1, month: -1 });
            
        res.json(ledgers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Log a compensation against a ledger
// @route   POST /api/expiry/ledgers/:id/compensate
// @access  Private (Admin)
export const logCompensation = async (req, res) => {
    try {
        const { type, value, note } = req.body; // type: 'Physical' or 'Financial'
        
        const ledger = await SupplierExpiryLedger.findById(req.params.id).populate('supplierId', 'name');
        if (!ledger) return res.status(404).json({ message: 'Ledger not found' });

        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return res.status(400).json({ message: 'Invalid value' });

        ledger.compensations.push({
            type,
            value: val,
            note
        });
        
        ledger.totalValueCompensated += val;
        
        await ledger.save();
        res.json(ledger);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
