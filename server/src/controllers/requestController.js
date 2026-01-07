import PharmacistRequest from '../models/PharmacistRequest.js';

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
                isCustom: !!(item.isCustom || item._id?.toString().startsWith('custom-'))
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
        }

        const requests = await PharmacistRequest.find(query)
            .populate('pharmacistId', 'username')
            .populate({
                path: 'items.medicineId',
                select: 'name supplierId',
                populate: {
                    path: 'supplierId',
                    select: 'name'
                }
            })
            .sort({ createdAt: -1 });

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
