import ExpiryReturn from '../models/ExpiryReturn.js';
import Medicine from '../models/Medicine.js';
import SupplierExpiryLedger from '../models/SupplierExpiryLedger.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// --- PHARMACIST ROUTES ---

// @desc    Create a new Expiry Return (Draft or Submitted)
// @route   POST /api/expiry
// @access  Private (Pharmacist)
export const createExpiryReturn = async (req, res) => {
    try {
        const { month, year, items, status } = req.body;
        
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
// @route   GET /api/expiry/all
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

// @desc    Get count of unverified (Submitted) expiry returns
// @route   GET /api/expiry/pending-count
// @access  Private (Admin)
export const getPendingExpiryCount = async (req, res) => {
    try {
        const count = await ExpiryReturn.countDocuments({ status: 'Submitted' });
        res.json({ count });
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

        // Build verified items — snapshot cost price, set handoverStatus = Pending
        const verifiedItems = [];
        for (const item of items) {
            const med = await Medicine.findById(item.medicineId);

            verifiedItems.push({
                medicineId: item.medicineId || null,
                customName: item.customName || '',
                qtySent: item.qtySent || 0,
                qtySentLoose: item.qtySentLoose || 0,
                qtyReceived: item.qtyReceived,
                qtyReceivedLoose: item.qtyReceivedLoose,
                isNonReturnable: item.isNonReturnable || false,
                costPriceAtReturn: med?.costPrice || 0,
                // Items start as Pending handover
                // Disposed items are excluded from handover automatically
                handoverStatus: 'Pending',
                handedOverAt: null
            });

            if (item.qtySent !== item.qtyReceived) anyChanges = true;
        }

        expiryList.items = verifiedItems;
        expiryList.status = 'Verified';
        expiryList.verifiedAt = new Date();
        await expiryList.save();

        // NOTE: Supplier ledger is NOT created here anymore.
        // It is created when the store physically processes a handover (POST /expiry/handover)

        // Notify pharmacist
        await Notification.create({
            userId: expiryList.branchId,
            title: 'Expiry List Verified',
            message: `The Store has verified your ${expiryList.month}/${expiryList.year} expiry list.` +
                (storeNote ? ' They added a note.' : (anyChanges ? ' Some quantities were adjusted.' : '')),
            link: '/pharmacist-dashboard/expiry'
        });

        res.json(expiryList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// --- HANDOVER ROUTES ---

// @desc    Get all verified items pending handover, grouped by supplier
// @route   GET /api/expiry/handover-pending
// @access  Private (Admin)
export const getPendingHandoverItems = async (req, res) => {
    try {
        // All verified returns that have at least one item pending handover
        const returns = await ExpiryReturn.find({ status: 'Verified' })
            .populate('branchId', 'name')
            .populate({
                path: 'items.medicineId',
                select: 'name barcode supplierId costPrice unitsPerBox',
                populate: { path: 'supplierId', select: 'name' }
            });

        // Flatten to individual pending (non-disposed) items, group by supplier
        const supplierMap = {}; // { supplierId: { supplier, items[] } }

        for (const ret of returns) {
            for (const item of ret.items) {
                // Skip: already handed over, disposed, or custom/no-supplier items
                if (item.handoverStatus === 'HandedOver') continue;
                if (item.isNonReturnable) continue;
                if (!item.medicineId || !item.medicineId.supplierId) continue;
                
                const hasBoxes = item.qtyReceived !== null && item.qtyReceived > 0;
                const hasLoose = item.qtyReceivedLoose !== null && item.qtyReceivedLoose > 0;
                if (!hasBoxes && !hasLoose) continue;

                const supplier = item.medicineId.supplierId;
                const sid = supplier._id.toString();

                if (!supplierMap[sid]) {
                    supplierMap[sid] = { supplier, items: [] };
                }

                const units = item.medicineId.unitsPerBox || 1;
                const valBoxes = item.qtyReceived * item.costPriceAtReturn;
                const valLoose = (item.qtyReceivedLoose || 0) * (item.costPriceAtReturn / units);

                supplierMap[sid].items.push({
                    expiryReturnId: ret._id,
                    itemId: item._id,
                    branchName: ret.branchId?.name || 'Unknown',
                    month: ret.month,
                    year: ret.year,
                    medicineName: item.medicineId.name,
                    medicineBarcode: item.medicineId.barcode,
                    medicineId: item.medicineId._id,
                    qtyReceived: item.qtyReceived,
                    qtyReceivedLoose: item.qtyReceivedLoose || 0,
                    unitsPerBox: units,
                    costPriceAtReturn: item.costPriceAtReturn,
                    value: valBoxes + valLoose
                });
            }
        }

        // Convert to sorted array
        const result = Object.values(supplierMap).sort((a, b) =>
            a.supplier.name.localeCompare(b.supplier.name)
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Process handover for a supplier — mark items handed over, update ledger
// @route   POST /api/expiry/handover
// @access  Private (Admin)
export const processHandover = async (req, res) => {
    try {
        // items: [{ expiryReturnId, itemId }]
        const { supplierId, items } = req.body;

        if (!supplierId || !items || items.length === 0) {
            return res.status(400).json({ message: 'supplierId and items are required' });
        }

        // Group items by (expiryReturnId, month, year) for ledger bucketing
        const ledgerGroups = {}; // key: `${month}-${year}` → { month, year, totalValue }

        for (const ref of items) {
            const expiryReturn = await ExpiryReturn.findById(ref.expiryReturnId);
            if (!expiryReturn) continue;

            const item = expiryReturn.items.id(ref.itemId);
            if (!item || item.handoverStatus === 'HandedOver') continue;

            // Mark as handed over
            item.handoverStatus = 'HandedOver';
            item.handedOverAt = new Date();
            await expiryReturn.save();

            // Need units to calculate loose cost correctly
            const med = await Medicine.findById(item.medicineId);
            const units = med?.unitsPerBox || 1;
            const valBoxes = item.qtyReceived * item.costPriceAtReturn;
            const valLoose = (item.qtyReceivedLoose || 0) * (item.costPriceAtReturn / units);

            // Accumulate ledger value per month/year bucket
            const key = `${expiryReturn.month}-${expiryReturn.year}`;
            if (!ledgerGroups[key]) {
                ledgerGroups[key] = { month: expiryReturn.month, year: expiryReturn.year, totalValue: 0 };
            }
            ledgerGroups[key].totalValue += (valBoxes + valLoose);
        }

        // Create / update one ledger entry per month-year bucket
        const updatedLedgers = [];
        for (const group of Object.values(ledgerGroups)) {
            if (group.totalValue <= 0) continue;

            let ledger = await SupplierExpiryLedger.findOne({
                supplierId,
                month: group.month,
                year: group.year
            });

            if (!ledger) {
                ledger = new SupplierExpiryLedger({
                    supplierId,
                    month: group.month,
                    year: group.year,
                    totalValueHandedOver: group.totalValue
                });
            } else {
                ledger.totalValueHandedOver += group.totalValue;
            }

            await ledger.save();
            updatedLedgers.push(ledger);
        }

        res.json({ message: 'Handover processed successfully', updatedLedgers });
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
        const { supplierId, year, months } = req.query;
        
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
        const { type, value, note } = req.body;
        
        const ledger = await SupplierExpiryLedger.findById(req.params.id).populate('supplierId', 'name');
        if (!ledger) return res.status(404).json({ message: 'Ledger not found' });

        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return res.status(400).json({ message: 'Invalid value' });

        ledger.compensations.push({ type, value: val, note });
        ledger.totalValueCompensated += val;
        
        await ledger.save();
        res.json(ledger);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete an expiry return
// @route   DELETE /api/expiry/:id
// @access  Private (Admin)
export const deleteExpiryReturn = async (req, res) => {
    try {
        const { password } = req.body;
        const expiryList = await ExpiryReturn.findById(req.params.id);

        if (!expiryList) {
            return res.status(404).json({ message: 'Expiry list not found' });
        }

        // Only allow deleting Draft or Submitted (unverified) returns
        if (expiryList.status === 'Verified') {
            return res.status(400).json({ message: 'Cannot delete a verified expiry return' });
        }

        const user = await req.user;
        if (!user || user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // We need the admin user's password hash from DB
        const adminUser = await User.findById(req.user._id);

        if (!password || !(await adminUser.matchPassword(password))) {
             return res.status(401).json({ message: 'Invalid Admin Password' });
        }

        await expiryList.deleteOne();
        res.json({ message: 'Expiry return deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
