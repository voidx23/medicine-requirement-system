import api from './api';

const storeStaffService = {
  getAll: async () => {
    const response = await api.get('/store-staff');
    return response.data;
  },

  create: async (staffData) => {
    const response = await api.post('/store-staff', staffData);
    return response.data;
  },

  update: async (id, staffData) => {
    const response = await api.put(`/store-staff/${id}`, staffData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/store-staff/${id}`);
    return response.data;
  }
};

export default storeStaffService;
