import PharmacistRequest from '../models/PharmacistRequest.js';
import User from '../models/User.js';
import RequirementList from '../models/RequirementList.js'; // Kept for reference but not used in forwardItems anymore

// @desc    Submit a new requirement list
// @route   POST /api/requests/submit
// @access  Private (Pharmacist)
export const submitRequest = async (req, res) => {
    try {
        const { items, submittedBy } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No items in request' });
        }

        const request = await PharmacistRequest.create({
            pharmacistId: req.user._id,
            submittedBy,
            items: items.map(item => ({
                medicineId: (item.isCustom || item._id?.toString().startsWith('custom-')) ? null : item._id,
                name: item.name,
                quantity: item.quantity,
                isCustom: !!(item.isCustom || item._id?.toString().startsWith('custom-')),
                isUrgent: !!item.isUrgent
            })),
            status: 'pending'
        });

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all requests (Admin) or My Requests (Pharmacist)
// @route   GET /api/requests
// @access  Private
export const getRequests = async (req, res) => {
    try {
        let query = {};
        
        // If not admin, only show own requests
        if (req.user.role !== 'admin') {
            query.pharmacistId = req.user._id;
        } else if (req.query.branchId && req.query.branchId !== 'all') {
            query.pharmacistId = req.query.branchId;
        }

        if (req.query.status) {
            // e.g. status=pending,approved
            query.status = { $in: req.query.status.split(',') };
        }

        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                const start = new Date(req.query.startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }
            if (req.query.endDate) {
                const end = new Date(req.query.endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const requests = await PharmacistRequest.find(query)
            .populate('pharmacistId', 'name location')
            .populate({
                path: 'items.medicineId',
                select: 'name supplierId',
                populate: {
                    path: 'supplierId',
                    select: 'name'
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        res.setHeader('Cache-Control', 'no-cache, private');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update request status
// @route   PUT /api/requests/:id/status
// @access  Private (Admin only)
export const updateRequestStatus = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const request = await PharmacistRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        request.status = status;
        if (adminNotes) {
            request.adminNotes = adminNotes;
        }

        const updatedRequest = await request.save();
        res.json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Get Stats (Count of today's requests)
// @route   GET /api/requests/stats
// @access  Private
export const getStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        let query = {
            createdAt: { $gte: today }
        };

        if (req.user.role !== 'admin') {
            query.pharmacistId = req.user._id;
        }

        const count = await PharmacistRequest.countDocuments(query);
        res.json({ todayParams: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a request (Admin)
// @route   DELETE /api/requests/:id
// @access  Private (Admin)
export const deleteRequest = async (req, res) => {
    try {
        const { password } = req.body;
        const request = await PharmacistRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Verify Admin Password
        const user = await req.user; // User is attached by protect middleware
        if (!user || user.role !== 'admin') {
             return res.status(401).json({ message: 'Not authorized' });
        }
        
        // Check password logic (Using the user instance methods if available, or manual compare)
        // Since `protect` middleware fetches the user without password by default usually, 
        // we might need to fetch user AGAIN with password.
        // Let's check middleware/authMiddleware.js to see if it selects password.
        // Usually it does .select('-password').
        
        // So we need to fetch user explicitly with password
        const adminUser = await User.findById(req.user._id); 
        
        if (!password || !(await adminUser.matchPassword(password))) {
             return res.status(401).json({ message: 'Invalid Admin Password' });
        }

        await request.deleteOne();
        res.json({ message: 'Request removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update status of a specific item in a request
// @route   PUT /api/requests/:id/items/:itemId/status
// @access  Private (Admin only)
export const updateItemStatus = async (req, res) => {
    try {
        const { status } = req.body; // Expecting 'packed' or 'pending'
        const request = await PharmacistRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const item = request.items.id(req.params.itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found in request' });
        }

        item.status = status;

        // Auto-update request status logic
        const allItems = request.items;
        const totalItems = allItems.length;
        const packedItems = allItems.filter(i => i.status === 'packed').length;

        if (packedItems === totalItems) {
            request.status = 'completed';
        } else if (packedItems > 0) {
            request.status = 'partially_fulfilled';
        } else {
            request.status = 'unfulfilled';
        }
        
        await request.save();
        res.json(request);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Batch fulfill items and complete request
// @route   PUT /api/requests/:id/fulfill
// @access  Private (Admin only)
export const fulfillRequest = async (req, res) => {
    try {
        const { items } = req.body; // Expecting array of { _id, status }
        const request = await PharmacistRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Update items based on the batch request
        if (items && Array.isArray(items)) {
            items.forEach(updateItem => {
                const item = request.items.id(updateItem._id);
                if (item && updateItem.status) {
                    item.status = updateItem.status;
                }
            });
        }

        // Calculate final status
        const allItems = request.items;
        const totalItems = allItems.length;
        const packedItems = allItems.filter(i => i.status === 'packed').length;

        if (packedItems === totalItems) {
            request.status = 'completed';
        } else if (packedItems > 0) {
            request.status = 'partially_fulfilled';
        } else {
            request.status = 'unfulfilled';
        }

        const updatedRequest = await request.save();
        res.json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset request status to approved (Unlock for editing)
// @route   PUT /api/requests/:id/reset
// @access  Private (Admin only)
export const resetRequest = async (req, res) => {
    try {
        const { password } = req.body;
        const request = await PharmacistRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Verify Admin Password
        const user = await req.user; 
        if (!user || user.role !== 'admin') {
             return res.status(401).json({ message: 'Not authorized' });
        }
        
        const adminUser = await User.findById(req.user._id); 
        if (!password || !(await adminUser.matchPassword(password))) {
             return res.status(401).json({ message: 'Invalid Admin Password' });
        }

        // Unlock logic: Set status back to 'pending' and flag as processed
        request.status = 'pending';
        request.wasProcessed = true;
        
        const updatedRequest = await request.save();
        res.json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Forward unfulfilled items to new request cart
// @route   POST /api/requests/:id/forward
// @access  Private (Pharmacist)
// @desc    Forward unfulfilled items to new request cart (Client-side)
// @route   POST /api/requests/:id/forward
// @access  Private (Pharmacist)
export const forwardItems = async (req, res) => {
    try {
        const { itemsToForward } = req.body; // Array of item IDs
        
        const request = await PharmacistRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: "Request not found" });

        if (request.forwardingProcessed) {
            return res.status(400).json({ message: "This request has already been acted upon for forwarding." });
        }

        let forwardedItems = [];
        
        // Loop through request items
        request.items.forEach(item => {
            // Check if this item is in the 'to forward' list
            if (itemsToForward && itemsToForward.includes(item._id.toString())) {
                
                // Collect item details to return to client
                forwardedItems.push({
                    _id: item._id, // Original ID ref (optional)
                    medicineId: item.medicineId,
                    name: item.name,
                    quantity: item.quantity,
                    isCustom: item.isCustom,
                    isUrgent: !!item.isUrgent
                });

                // Mark as forwarded in OLD list
                item.status = 'forwarded';

            } else {
                // Ignore unselected items (leave as skipped/pending)
            }
        });

        request.forwardingProcessed = true;
        
        await request.save();

        // Return the forwarded items so client can add them to localStorage cart
        res.json({ 
            message: `Successfully forwarded ${forwardedItems.length} items.`, 
            forwardedItems 
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all medicine IDs currently sitting in a pending request for a branch
// @route   GET /api/requests/my-pending-medicines
// @access  Private (Pharmacist)
export const getMyPendingMedicines = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Find requests that are either currently pending OR were created in the last 2 calendar days (yesterday & today)
        const recentRequests = await PharmacistRequest.find({
            pharmacistId: req.user._id,
            $or: [
                { status: 'pending' },
                { createdAt: { $gte: yesterday } }
            ]
        }).select('items createdAt status');

        const pendingMap = {};

        // Build the dictionary mapping medicine to its request date and block type
        recentRequests.forEach(request => {
            const isHardBlock = request.status === 'pending';
            
            request.items.forEach(item => {
                // To track both standard medicines and custom names reliably
                const key = item.medicineId ? item.medicineId.toString() : item.name.trim().toLowerCase();
                
                // If it's already recorded as a hard block, don't downgrade it to a soft block
                if (pendingMap[key] && pendingMap[key].type === 'hard') {
                    return;
                }
                
                pendingMap[key] = {
                    date: request.createdAt,
                    type: isHardBlock ? 'hard' : 'soft'
                };
            });
        });

        res.json(pendingMap);
    } catch (error) {
         res.status(500).json({ message: error.message });
    }
};
