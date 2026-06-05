import Task from '../models/Task.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';

// @desc    Create a new task (general: admin only | transfer_request: admin or pharmacist)
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res) => {
    try {
        const { type = 'general', title, description, priority, dueDate, targetAudience, specificPharmacyIds, transferDetails } = req.body;

        const isAdmin = req.user.role === 'admin';
        const isBranch = req.user.role === 'branch';

        // Role check: only admin can create general tasks
        if (type === 'general' && !isAdmin) {
            return res.status(403).json({ message: 'Only admin can create general tasks' });
        }

        // ── General Task ──────────────────────────────────────────────────
        if (type === 'general') {
            if (!title || !description || !targetAudience) {
                return res.status(400).json({ message: 'Title, description, and target audience are required' });
            }

            let assignments = [];
            if (targetAudience === 'All') {
                const branches = await Branch.find({}).select('_id');
                assignments = branches.map(b => ({ pharmacyId: b._id, status: 'Pending' }));
            } else if (targetAudience === 'Specific') {
                if (!specificPharmacyIds?.length) {
                    return res.status(400).json({ message: 'Specific pharmacies must be selected' });
                }
                assignments = specificPharmacyIds.map(id => ({ pharmacyId: id, status: 'Pending' }));
            }

            const task = new Task({ type: 'general', title, description, priority, dueDate, createdBy: req.user._id, targetAudience, assignments });
            const createdTask = await task.save();
            return res.status(201).json(createdTask);
        }

        // ── Transfer Request Task ─────────────────────────────────────────
        if (type === 'transfer_request') {
            const { items, donorBranchId, recipientBranchId } = transferDetails || {};

            if (!items?.length || !donorBranchId) {
                return res.status(400).json({ message: 'At least one medicine and donor branch are required' });
            }

            // If branch creates it, recipient is themselves
            const finalRecipientId = isBranch ? req.user._id : recipientBranchId;
            if (!finalRecipientId) {
                return res.status(400).json({ message: 'Recipient branch is required' });
            }

            // Auto-generate a readable title: "Medicine A & 2 others"
            const firstItemName = items[0].medicineName;
            const otherCount = items.length - 1;
            const autoTitle = `Transfer Request: ${firstItemName}${otherCount > 0 ? ` & ${otherCount} others` : ''} → ${req.user.username}`;

            const task = new Task({
                type: 'transfer_request',
                title: autoTitle,
                description: `Transfer of ${items.length} item(s) requested.`,
                createdBy: req.user._id,
                targetAudience: 'Specific',
                assignments: [{ pharmacyId: donorBranchId, status: 'Pending' }],
                transferDetails: {
                    items: items.map(it => ({
                        _id: new mongoose.Types.ObjectId(),
                        medicineName: it.medicineName,
                        medicineId: it.medicineId || null,
                        requestedQty: it.requestedQty,
                        responseStatus: 'pending'
                    })),
                    donorBranchId,
                    recipientBranchId: finalRecipientId,
                }
            });

            const createdTask = await task.save();
            return res.status(201).json(createdTask);
        }

        return res.status(400).json({ message: 'Invalid task type' });

    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Server error creating task' });
    }
};

// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private/Admin
export const updateTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        if (!req.user.isSuperAdmin && task.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Forbidden: You can only edit tasks/transfers that you created.' });
        }

        if (task.type === 'general') {
            const { title, description, priority, dueDate } = req.body;
            task.title = title || task.title;
            task.description = description || task.description;
            task.priority = priority || task.priority;
            task.dueDate = dueDate !== undefined ? dueDate : task.dueDate;

        } else if (task.type === 'transfer_request') {
            const isFullyPending = task.transferDetails.items.every(it => it.responseStatus === 'pending');
            if (!isFullyPending) {
                return res.status(400).json({ message: 'Cannot edit a transfer request that has already been partially responded to' });
            }
            const { items, donorBranchId, recipientBranchId } = req.body.transferDetails || {};
            if (items) task.transferDetails.items = items;
            if (donorBranchId) {
                task.transferDetails.donorBranchId = donorBranchId;
                // Update the assignment to point to the new donor
                task.assignments = [{ pharmacyId: donorBranchId, status: 'Pending' }];
            }
            if (recipientBranchId) task.transferDetails.recipientBranchId = recipientBranchId;
            
            // Refresh auto-title
            const firstItemName = task.transferDetails.items[0]?.medicineName || 'Items';
            const otherCount = task.transferDetails.items.length - 1;
            task.title = `Transfer Request: ${firstItemName}${otherCount > 0 ? ` & ${otherCount} others` : ''} → ${task.createdBy.username || 'Branch'}`;
            task.description = `Transfer of ${task.transferDetails.items.length} item(s) requested.`;
        }

        const updatedTask = await task.save();
        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Server error updating task' });
    }
};


// @desc    Get all tasks (Admin view)
// @route   GET /api/tasks
// @access  Private/Admin
export const getAdminTasks = async (req, res) => {
    try {
        const tasks = await Task.find({}).sort({ createdAt: -1 })
            .populate('createdBy', 'username location')
            .populate('assignments.pharmacyId', 'name location')
            .populate('transferDetails.donorBranchId', 'name location')
            .populate('transferDetails.recipientBranchId', 'name location');

        res.json(tasks);
    } catch (error) {
        console.error('Error fetching admin tasks:', error);
        res.status(500).json({ message: 'Server error fetching tasks' });
    }
};

// @desc    Get tasks for the logged-in pharmacy (assigned to them OR they created a transfer request)
// @route   GET /api/tasks/pharmacy
// @access  Private (Pharmacist only)
export const getPharmacyTasks = async (req, res) => {
    try {
        const userId = req.user._id;

        // Tasks assigned to this pharmacy (as donor) OR created by this pharmacy (transfer requests they initiated)
        const tasks = await Task.find({
            $or: [
                { 'assignments.pharmacyId': userId },
                { createdBy: userId, type: 'transfer_request' },
            ]
        })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'username location')
        .populate('transferDetails.donorBranchId', 'name location')
        .populate('transferDetails.recipientBranchId', 'name location');

        const mappedTasks = tasks.map(task => {
            const myAssignment = task.assignments.find(a => a.pharmacyId?.toString() === userId.toString());
            const iCreatedThis = task.createdBy?._id?.toString() === userId.toString();

            return {
                _id: task._id,
                type: task.type,
                title: task.title,
                description: task.description,
                priority: task.priority,
                dueDate: task.dueDate,
                createdBy: task.createdBy,
                createdAt: task.createdAt,
                myAssignment,
                // Transfer-specific fields
                transferDetails: task.transferDetails,
                transferResponse: task.transferResponse,
                // Role: am I the donor needing to respond, or the requester tracking status?
                transferRole: task.type === 'transfer_request'
                    ? (iCreatedThis ? 'requester' : 'donor')
                    : null,
            };
        });

        res.json(mappedTasks);
    } catch (error) {
        console.error('Error fetching pharmacy tasks:', error);
        res.status(500).json({ message: 'Server error fetching tasks' });
    }
};

// @desc    Mark a general task as completed by a Pharmacy
// @route   PUT /api/tasks/:taskId/status
// @access  Private (Pharmacist only)
export const updateTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, comment } = req.body;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const assignmentIndex = task.assignments.findIndex(a => a.pharmacyId.toString() === req.user._id.toString());
        if (assignmentIndex === -1) return res.status(403).json({ message: 'You are not assigned to this task' });

        task.assignments[assignmentIndex].status = status || 'Completed';

        if (task.assignments[assignmentIndex].status === 'Completed') {
            task.assignments[assignmentIndex].completedAt = new Date();
            task.assignments[assignmentIndex].completedBy = req.user._id;
        }
        if (comment !== undefined) task.assignments[assignmentIndex].comment = comment;

        await task.save();
        res.json({ message: 'Task status updated successfully', task });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Server error updating task status' });
    }
};

// @desc    Donor branch accepts or rejects a transfer request (per-item)
// @route   PUT /api/tasks/:taskId/transfer-respond
// @access  Private (Pharmacist — donor branch only)
export const respondToTransfer = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { responses } = req.body; // Array of { itemId, action, responseQty, rejectionReason }

        if (!responses || !Array.isArray(responses)) {
            return res.status(400).json({ message: 'responses array is required' });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        if (task.type !== 'transfer_request') return res.status(400).json({ message: 'Not a transfer request task' });

        // Verify the caller is the donor
        const assignmentIndex = task.assignments.findIndex(a => a.pharmacyId.toString() === req.user._id.toString());
        if (assignmentIndex === -1) return res.status(403).json({ message: 'You are not the donor for this transfer request' });

        // Update each item
        responses.forEach((resItem, idx) => {
            let item = null;
            if (resItem.itemId && mongoose.Types.ObjectId.isValid(resItem.itemId)) {
                item = task.transferDetails.items.id(resItem.itemId);
            }
            if (!item) {
                // Fallback to match by index or medicineName/medicineId
                item = task.transferDetails.items.find((it, i) => {
                    return (resItem.index !== undefined && i === resItem.index) ||
                           (it.medicineName === resItem.medicineName) ||
                           (it.medicineId && resItem.medicineId && it.medicineId.toString() === resItem.medicineId.toString());
                });
            }

            if (item && item.responseStatus === 'pending') {
                item.responseStatus = resItem.action === 'accept' ? 'accepted' : 'rejected';
                if (resItem.action === 'accept') item.responseQty = resItem.responseQty;
                if (resItem.action === 'reject') item.rejectionReason = resItem.rejectionReason;
            }
        });

        task.transferDetails.respondedAt = new Date();

        // Check overall completion
        const allResponded = task.transferDetails.items.every(it => it.responseStatus !== 'pending');
        if (allResponded) {
            const anyAccepted = task.transferDetails.items.some(it => it.responseStatus === 'accepted');
            task.assignments[assignmentIndex].status = anyAccepted ? 'Completed' : 'Rejected';
            task.assignments[assignmentIndex].completedAt = new Date();
            task.assignments[assignmentIndex].completedBy = req.user._id;
        }

        await task.save();
        res.json({ message: `Transfer response updated`, task });
    } catch (error) {
        console.error('Error responding to transfer:', error);
        res.status(500).json({ message: 'Server error responding to transfer request' });
    }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private/Admin
export const deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (task) {
            if (!req.user.isSuperAdmin && task.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Forbidden: You can only delete tasks/transfers that you created.' });
            }
            await Task.deleteOne({ _id: req.params.id });
            res.json({ message: 'Task removed' });
        } else {
            res.status(404).json({ message: 'Task not found' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error deleting task' });
    }
};
