import api from './api';

const basePath = '/api/products';

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
    const query = { restaurant_id: restaurantId, limit: 200, ...params };
    const { data } = await api.get(basePath, { params: query });
    return normaliseListResponse(data);
  },

  async create(payload) {
    const response = await api.post(basePath, payload);
    return response?.data;
  },

  async update(id, payload) {
    const response = await api.patch(`${basePath}/${id}`, payload);
    return response?.data;
  },

  async remove(id) {
    await api.delete(`${basePath}/${id}`);
    return true;
  },
};

export default ownerProductService;
