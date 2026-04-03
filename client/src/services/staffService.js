import api from './api';

const staffService = {
    // Get all staff (optionally by branchId for admin)
    getAll: async (branchId = null) => {
        let url = '/staff';
        if (branchId) url += `?branchId=${branchId}`;
        const { data } = await api.get(url);
        return data; // Returns array of staff
    },

    // Add new staff
    add: async (staffData) => {
        const { data } = await api.post('/staff', staffData);
        return data;
    },

    // Update staff
    update: async (id, staffData) => {
        const { data } = await api.put(`/staff/${id}`, staffData);
        return data;
    },

    // Delete staff
    delete: async (id) => {
        const { data } = await api.delete(`/staff/${id}`);
        return data;
    },

    // Assign branch to staff
    assignBranch: async (staffId, branchId) => {
        const { data } = await api.put(`/staff/${staffId}/branch`, { branchId });
        return data;
    },

    // Remove branch from staff
    removeBranch: async (staffId, branchId) => {
        const { data } = await api.delete(`/staff/${staffId}/branch/${branchId}`);
        return data;
    },

    // Verify PIN
    verify: async (staffId, pin) => {
        // Returns { verified: true, staffId, name } or throws error
        const { data } = await api.post('/staff/verify', { staffId, pin });
        return data;
    },

    // Get all branches (Admin)
    getBranches: async () => {
        const { data } = await api.get('/staff/branches');
        return data;
    }
};

export default staffService;
