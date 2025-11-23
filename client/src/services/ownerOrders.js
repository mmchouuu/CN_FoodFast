import api from './api';

const basePath = '/owner/orders';

const OWNER_TOKEN_KEY = 'restaurant_token';
const OWNER_PROFILE_KEY = 'restaurant_profile';

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

const getOwnerProfileFromStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(OWNER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[ownerOrders] failed to parse cached owner profile', error);
    return null;
  }
};

const resolveOwnerToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const directToken = window.localStorage.getItem(OWNER_TOKEN_KEY);
    if (directToken) {
      return directToken;
    }

    const profile = getOwnerProfileFromStorage();
    const fallbackToken = profile?.authToken || profile?.token || null;
    if (fallbackToken) {
      window.localStorage.setItem(OWNER_TOKEN_KEY, fallbackToken);
      return fallbackToken;
    }
  } catch (error) {
    console.warn('[ownerOrders] failed to resolve owner token from storage', error);
  }

  return null;
};

const requireOwnerAuth = () => {
  const token = resolveOwnerToken();
  if (!token) {
    throw new Error('Owner session not found. Please sign in again.');
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

const withOwnerAuth = (config = {}) => {
  const auth = requireOwnerAuth();
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      ...auth.headers,
    },
  };
};

const ownerOrdersService = {
  async list(params = {}) {
    const config = withOwnerAuth({ params });
    const { data } = await api.get(basePath, config);
    return normaliseCollection(data);
  },

  async get(orderId) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const config = withOwnerAuth();
    const { data } = await api.get(`${basePath}/${orderId}`, config);
    return data;
  },

  async updateStatus(orderId, payload) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const body = payload || {};

    const config = withOwnerAuth();
    const { data } = await api.patch(`${basePath}/${orderId}/status`, body, config);
    return data;
  },

  async respondCancelRequest(orderId, payload = {}) {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    const config = withOwnerAuth();
    const { data } = await api.patch(`${basePath}/${orderId}/cancel-request`, payload, config);
    return data;
  },

  async createRevision(orderId, payload = {}) {
    if (!orderId) {
      throw new Error('orderId is required');
    }

    const config = withOwnerAuth();
    const { data } = await api.post(`${basePath}/${orderId}/revisions`, payload, config);
    return data;
  },
};

export default ownerOrdersService;
