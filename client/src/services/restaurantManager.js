import api from './api';

const basePath = '/api/catalog/restaurants';

const restaurantManagerService = {
  async getByOwner(ownerId) {
    const { data } = await api.get(`${basePath}/owner/${ownerId}`);
    return data;
  },

  async listByOwner(ownerId) {
    const { data } = await api.get(`${basePath}/owner/${ownerId}/list`);
    return data;
  },

  async createRestaurant(payload) {
    const { data } = await api.post(basePath, payload);
    return data;
  },

  async createBranch(restaurantId, payload) {
    const { data } = await api.post(`${basePath}/${restaurantId}/branches`, payload);
    return data;
  },

  async updateBranch(restaurantId, branchId, payload) {
    const { data } = await api.put(`${basePath}/${restaurantId}/branches/${branchId}`, payload);
    return data;
  },

  async listBranches(restaurantId) {
    const { data } = await api.get(`${basePath}/${restaurantId}/branches`);
    return data;
  },

  async updateRestaurant(restaurantId, payload) {
    const { data } = await api.put(`${basePath}/${restaurantId}`, payload);
    return data;
  },
};

export default restaurantManagerService;
