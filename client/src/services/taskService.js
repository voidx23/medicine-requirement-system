import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const authHeader = (token) => ({
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
});

// ── General Task (Admin only) ─────────────────────────────────────────────────

const createTask = async (taskData, token) => {
    const response = await axios.post(`${API_URL}/tasks`, { ...taskData, type: 'general' }, authHeader(token));
    return response.data;
};

const getAdminTasks = async (token) => {
    const response = await axios.get(`${API_URL}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
};

const updateTask = async (taskId, taskData, token) => {
    const response = await axios.put(`${API_URL}/tasks/${taskId}`, taskData, authHeader(token));
    return response.data;
};

const deleteTask = async (taskId, token) => {
    const response = await axios.delete(`${API_URL}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
};

// ── Pharmacy Tasks ────────────────────────────────────────────────────────────

const getPharmacyTasks = async (token) => {
    const response = await axios.get(`${API_URL}/tasks/pharmacy`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
};

const updateTaskStatus = async (taskId, statusData, token) => {
    const response = await axios.put(`${API_URL}/tasks/${taskId}/status`, statusData, authHeader(token));
    return response.data;
};

// ── Transfer Request ──────────────────────────────────────────────────────────

/**
 * Create a transfer_request task (pharmacist or admin)
 * @param {{ medicineName, medicineId, requestedQty, donorBranchId, recipientBranchId? }} details
 */
const createTransferRequest = async (details, token) => {
    const response = await axios.post(
        `${API_URL}/tasks`,
        { type: 'transfer_request', transferDetails: details },
        authHeader(token)
    );
    return response.data;
};

/**
 * Donor branch responds to a transfer request
 * @param {'accept'|'reject'} action
 * @param {{ responseQty?, rejectionReason? }} data
 */
const respondToTransfer = async (taskId, action, data, token) => {
    const response = await axios.put(
        `${API_URL}/tasks/${taskId}/transfer-respond`,
        { action, ...data },
        authHeader(token)
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
