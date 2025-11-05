import api from './api';

const basePath = '/owner/orders';

const normaliseCollection = (payload) => {
  if (!payload) {
    return { data: [], pagination: null };
  }

  if (Array.isArray(payload)) {
    return { data: payload, pagination: null };
  }

  if (Array.isArray(payload?.data)) {
    return {
      data: payload.data,
      pagination: payload.pagination || null,
    };
  }

  if (Array.isArray(payload?.orders)) {
    return {
      data: payload.orders,
      pagination: payload.pagination || null,
    };
  }

  return {
    data: [],
    pagination: payload.pagination || null,
  };
};

const ownerOrdersService = {
  async list(params = {}) {
    const { data } = await api.get(basePath, { params });
    return normaliseCollection(data);
  },

  async get(orderId) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const { data } = await api.get(`${basePath}/${orderId}`);
    return data;
  },

  async updateStatus(orderId, payload) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const body = payload || {};
    const { data } = await api.patch(`${basePath}/${orderId}/status`, body);
    return data;
  },

  async createRevision(orderId, payload = {}) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const { data } = await api.post(`${basePath}/${orderId}/revisions`, payload);
    return data;
  },
};

export default ownerOrdersService;
