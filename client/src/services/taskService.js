import api from './api';

// ── General Task (Admin only) ─────────────────────────────────────────────────

const createTask = async (taskData) => {
    const response = await api.post('/tasks', { ...taskData, type: 'general' });
    return response.data;
};

const getAdminTasks = async () => {
    const response = await api.get('/tasks');
    return response.data;
};

const updateTask = async (taskId, taskData) => {
    const response = await api.put(`/tasks/${taskId}`, taskData);
    return response.data;
};

const deleteTask = async (taskId) => {
    const response = await api.delete(`/tasks/${taskId}`);
    return response.data;
};

// ── Pharmacy Tasks ────────────────────────────────────────────────────────────

const getPharmacyTasks = async () => {
    const response = await api.get('/tasks/pharmacy');
    return response.data;
};

const updateTaskStatus = async (taskId, statusData) => {
    const response = await api.put(`/tasks/${taskId}/status`, statusData);
    return response.data;
};

// ── Transfer Request ──────────────────────────────────────────────────────────

/**
 * Create a transfer_request task (pharmacist or admin)
 * @param {{ medicineName, medicineId, requestedQty, donorBranchId, recipientBranchId? }} details
 */
const createTransferRequest = async (details) => {
    const response = await api.post(
        '/tasks',
        { type: 'transfer_request', transferDetails: details }
    );
    return response.data;
};

/**
 * Donor branch responds to a transfer request
 * @param {'accept'|'reject'} action
 * @param {{ responseQty?, rejectionReason? }} data
 */
const respondToTransfer = async (taskId, action, data) => {
    const response = await api.put(
        `/tasks/${taskId}/transfer-respond`,
        { action, ...data }
    );
    return response.data;
};

const taskService = {
    createTask,
    updateTask,
    getAdminTasks,
    deleteTask,
    getPharmacyTasks,
    updateTaskStatus,
    createTransferRequest,
    respondToTransfer,
};

export default taskService;
