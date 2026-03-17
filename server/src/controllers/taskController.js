import Task from '../models/Task.js';
import User from '../models/User.js';

// @desc    Create a new task (general: admin only | transfer_request: admin or pharmacist)
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res) => {
    try {
        const { type = 'general', title, description, priority, dueDate, targetAudience, specificPharmacyIds, transferDetails } = req.body;

        const isAdmin = req.user.role === 'admin';
        const isPharmacist = req.user.role === 'pharmacist';

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
                const pharmacies = await User.find({ role: 'pharmacist' }).select('_id');
                assignments = pharmacies.map(ph => ({ pharmacyId: ph._id, status: 'Pending' }));
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
            const { medicineName, medicineId, requestedQty, donorBranchId, recipientBranchId } = transferDetails || {};

            if (!medicineName || !requestedQty || !donorBranchId) {
                return res.status(400).json({ message: 'Medicine name, quantity, and donor branch are required' });
            }

            // If pharmacist creates it, recipient is themselves
            const finalRecipientId = isPharmacist ? req.user._id : recipientBranchId;
            if (!finalRecipientId) {
                return res.status(400).json({ message: 'Recipient branch is required' });
            }

            // Auto-generate a readable title
            const autoTitle = `Transfer Request: ${medicineName} → ${req.user.username}`;

            const task = new Task({
                type: 'transfer_request',
                title: autoTitle,
                description: `Transfer of ${requestedQty} unit(s) of ${medicineName} requested.`,
                createdBy: req.user._id,
                targetAudience: 'Specific',
                assignments: [{ pharmacyId: donorBranchId, status: 'Pending' }],
                transferDetails: {
                    medicineName,
                    medicineId: medicineId || null,
                    requestedQty,
                    donorBranchId,
                    recipientBranchId: finalRecipientId,
                },
                transferResponse: { responseStatus: 'pending' },
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

        if (task.type === 'general') {
            const { title, description, priority, dueDate } = req.body;
            task.title = title || task.title;
            task.description = description || task.description;
            task.priority = priority || task.priority;
            task.dueDate = dueDate !== undefined ? dueDate : task.dueDate;

        } else if (task.type === 'transfer_request') {
            if (task.transferResponse?.responseStatus !== 'pending') {
                return res.status(400).json({ message: 'Cannot edit a transfer request that has already been responded to' });
            }
            const { medicineName, medicineId, requestedQty, donorBranchId, recipientBranchId } = req.body.transferDetails || {};
            if (medicineName) task.transferDetails.medicineName = medicineName;
            if (medicineId !== undefined) task.transferDetails.medicineId = medicineId || null;
            if (requestedQty) task.transferDetails.requestedQty = requestedQty;
            if (donorBranchId) {
                task.transferDetails.donorBranchId = donorBranchId;
                // Update the assignment to point to the new donor
                task.assignments = [{ pharmacyId: donorBranchId, status: 'Pending' }];
            }
            if (recipientBranchId) task.transferDetails.recipientBranchId = recipientBranchId;
            // Refresh auto-title
            task.title = `Transfer Request: ${task.transferDetails.medicineName} → ${task.transferDetails.recipientBranchId}`;
            task.description = `Transfer of ${task.transferDetails.requestedQty} unit(s) of ${task.transferDetails.medicineName} requested.`;
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
            .populate('assignments.pharmacyId', 'username location')
            .populate('transferDetails.donorBranchId', 'username location')
            .populate('transferDetails.recipientBranchId', 'username location');

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
        .populate('transferDetails.donorBranchId', 'username location')
        .populate('transferDetails.recipientBranchId', 'username location');

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

// @desc    Donor branch accepts or rejects a transfer request
// @route   PUT /api/tasks/:taskId/transfer-respond
// @access  Private (Pharmacist — donor branch only)
export const respondToTransfer = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { action, responseQty, rejectionReason } = req.body;

        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'action must be "accept" or "reject"' });
        }
        if (action === 'accept' && (!responseQty || responseQty <= 0)) {
            return res.status(400).json({ message: 'responseQty is required when accepting' });
        }
        if (action === 'reject' && !rejectionReason?.trim()) {
            return res.status(400).json({ message: 'rejectionReason is required when rejecting' });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        if (task.type !== 'transfer_request') return res.status(400).json({ message: 'Not a transfer request task' });

        // Verify the caller is the donor
        const assignmentIndex = task.assignments.findIndex(a => a.pharmacyId.toString() === req.user._id.toString());
        if (assignmentIndex === -1) return res.status(403).json({ message: 'You are not the donor for this transfer request' });

        if (task.transferResponse?.responseStatus !== 'pending') {
            return res.status(400).json({ message: 'This transfer request has already been responded to' });
        }

        // Update response
        task.transferResponse.responseStatus = action === 'accept' ? 'accepted' : 'rejected';
        task.transferResponse.respondedAt = new Date();
        if (action === 'accept') task.transferResponse.responseQty = responseQty;
        if (action === 'reject') task.transferResponse.rejectionReason = rejectionReason;

        // Update assignment status
        task.assignments[assignmentIndex].status = action === 'accept' ? 'Completed' : 'Rejected';
        task.assignments[assignmentIndex].completedAt = new Date();
        task.assignments[assignmentIndex].completedBy = req.user._id;

        await task.save();
        res.json({ message: `Transfer request ${action}ed successfully`, task });
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
