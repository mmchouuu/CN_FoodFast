import api from './api';

const basePath = '/api/orders';
const ownerBasePath = '/owner/orders';
const customerBasePath = '/customer/orders';


const unwrapCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const unwrapRecord = (payload) => {
  if (!payload) return null;
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
};

export async function listOrders(params = {}) {
  const { data } = await api.get(basePath, { params });
  return unwrapCollection(data);
}

export async function listOrdersByUser(userId, params = {}) {
  if (!userId) {
    throw new Error('userId is required to list orders by user');
  }

  try {
    const { data } = await api.get(customerBasePath, { params });
    return unwrapCollection(data);
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
  }

  const { data } = await api.get(`${basePath}/user/${userId}`, { params });
  return unwrapCollection(data);
}

export async function getOrder(orderId, { scope = 'customer' } = {}) {
  if (!orderId) {
    throw new Error('orderId is required');
  }

  if (scope === 'customer') {
    try {
      const { data } = await api.get(`${customerBasePath}/${orderId}`);
      return unwrapRecord(data);
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  }

  const { data } = await api.get(`${basePath}/${orderId}`);
  return unwrapRecord(data);
}

export async function createOrder(payload) {
  const { data } = await api.post(basePath, payload);
  return Array.isArray(data) ? data : unwrapRecord(data);
}

export async function cancelOrder(orderId, payload = {}) {
  if (!orderId) {
    throw new Error('orderId is required');
  }
  const { data } = await api.post(`${customerBasePath}/${orderId}/cancel`, payload);
  return unwrapRecord(data);
}

export async function confirmOrder(orderId, payload = {}, options = {}) {
  if (!orderId) {
    throw new Error('orderId is required');
  }

  const safePayload =
    payload && typeof payload === 'object'
      ? { ...payload }
      : {};


  if (!Object.keys(safePayload).length || safePayload.confirmed === undefined) {
    safePayload.confirmed = true;
  }

  const config = {};
  const userId = options?.userId || options?.user_id;
  if (userId) {
    config.params = { user_id: userId };
  }

  const forceCustomerRoute = options?.scope === 'customer';
  const forcePublicRoute = options?.scope === 'public';

  const invokeCustomerRoute = async () => {
    const { data } = await api.post(
      `${customerBasePath}/${orderId}/complete`,
      safePayload,
      config,
    );
    return unwrapRecord(data);
  };

  const invokePublicRoute = async () => {
    const { data } = await api.post(
      `${basePath}/${orderId}/complete`,
      safePayload,
      config,
    );
    return unwrapRecord(data);
  };

  if (forceCustomerRoute) {
    return invokeCustomerRoute();
  }

  if (forcePublicRoute) {
    return invokePublicRoute();
  }

  try {
    return await invokePublicRoute();
  } catch (error) {
    if (error?.response?.status && error.response.status !== 404) {
      throw error;
    }
  }

  return invokeCustomerRoute();
}

export async function listOwnerOrders(params = {}) {
  const { data } = await api.get(ownerBasePath, { params });
  return data;
}

export async function getOwnerOrder(orderId) {
  const { data } = await api.get(`${ownerBasePath}/${orderId}`);
  return data;
}

export async function updateOwnerOrderStatus(orderId, payload) {
  const { data } = await api.patch(`${ownerBasePath}/${orderId}/status`, payload);
  return data;
}


const ordersService = {
  list: listOrders,
  listByUser: listOrdersByUser,
  get: getOrder,
  createOrder,
  cancelOrder,
  confirmOrder,


};

export default ordersService;
