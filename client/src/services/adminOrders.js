import api from './api';

const basePath = '/admin/orders';

const unwrapOrders = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.orders)) return payload.orders;
  return [];
};

const adminOrdersService = {
  async list(params = {}) {
    const { data } = await api.get(basePath, { params });
    return unwrapOrders(data);
  },

  async get(orderId) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const { data } = await api.get(`${basePath}/${orderId}`);
    return data;
  },

  async update(orderId, payload = {}) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const body = { ...(payload || {}) };
    const { data } = await api.patch(`${basePath}/${orderId}`, body);
    return data;
  },

  async cancel(orderId, payload = {}) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const { data } = await api.delete(`${basePath}/${orderId}`, { data: payload });
    return data;
  },
};

export default adminOrdersService;
