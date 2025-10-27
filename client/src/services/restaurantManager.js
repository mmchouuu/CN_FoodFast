import api from './api';

const basePath = '/api/restaurants';

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
    const body = { ...(payload || {}) };
    if (!body.ownerUserId && body.ownerId) {
      body.ownerUserId = body.ownerId;
      delete body.ownerId;
    }
    if (body.ownerMainAccount?.loginEmail) {
      body.ownerMainAccount = {
        ...body.ownerMainAccount,
        loginEmail: body.ownerMainAccount.loginEmail.trim().toLowerCase(),
      };
    }
    const { data } = await api.post(basePath, body);
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

  async deleteBranch(restaurantId, branchId) {
    const { data } = await api.delete(`${basePath}/${restaurantId}/branches/${branchId}`);
    return data;
  },

  async listBranches(restaurantId) {
    const { data } = await api.get(`${basePath}/${restaurantId}/branches`);
    return data;
  },

  async getRestaurant(restaurantId) {
    const { data } = await api.get(`${basePath}/${restaurantId}`);
    return data;
  },

  async updateRestaurant(restaurantId, payload) {
    const { data } = await api.put(`${basePath}/${restaurantId}`, payload);
    return data;
  },
};

export default restaurantManagerService;
