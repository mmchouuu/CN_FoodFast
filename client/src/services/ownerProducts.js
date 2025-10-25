import api from './api';

function normaliseListResponse(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw?.data?.data)) return raw.data.data;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  if (Array.isArray(raw?.items)) return raw.items;
  return Array.isArray(raw) ? raw : [];
}

const ownerProductService = {
  async listByRestaurant(restaurantId, params = {}) {
    const query = { limit: 200, ...params };
    const { data } = await api.get(`/api/restaurants/${restaurantId}/products`, {
      params: query,
    });
    return normaliseListResponse(data);
  },

  async create(restaurantId, payload) {
    const response = await api.post(`/api/restaurants/${restaurantId}/products`, payload);
    return response?.data;
  },

  async update(restaurantId, productId, payload) {
    const response = await api.patch(
      `/api/restaurants/${restaurantId}/products/${productId}`,
      payload,
    );
    return response?.data;
  },

  async remove(restaurantId, productId) {
    await api.delete(`/api/restaurants/${restaurantId}/products/${productId}`);
    return true;
  },

  async fetchInventory(restaurantId, productId) {
    const { data } = await api.get(
      `/api/restaurants/${restaurantId}/products/${productId}/inventory`,
    );
    return normaliseListResponse(data);
  },

  async updateInventory(restaurantId, branchId, productId, payload) {
    const response = await api.put(
      `/api/restaurants/${restaurantId}/branches/${branchId}/inventory/${productId}`,
      payload,
    );
    return response?.data;
  },
};

export default ownerProductService;
