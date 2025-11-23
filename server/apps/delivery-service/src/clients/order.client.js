const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.orderServiceUrl,
  timeout: config.httpTimeout,
});

const serviceHeaders = {
  'x-user-id': config.serviceAuth.userId,
  'x-user-role': config.serviceAuth.role,
};

async function updateOrder(orderId, payload = {}) {
  if (!orderId) {
    throw new Error('orderId is required');
  }

  const response = await client.patch(`/admin/orders/${orderId}`, payload, {
    headers: serviceHeaders,
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    return response.data;
  }

  const error = new Error(
    response.data?.error ||
      response.data?.message ||
      `order-service update failed (${response.status})`,
  );
  error.status = response.status;
  error.data = response.data;
  throw error;
}

async function getOrder(orderId) {
  if (!orderId) {
    throw new Error('orderId is required');
  }
  const response = await client.get(`/admin/orders/${orderId}`, {
    headers: serviceHeaders,
    validateStatus: () => true,
  });
  if (response.status >= 200 && response.status < 300) {
    return response.data || null;
  }
  if (response.status === 404) {
    return null;
  }
  const error = new Error(
    response.data?.error ||
      response.data?.message ||
      `order-service fetch failed (${response.status})`,
  );
  error.status = response.status;
  error.data = response.data;
  throw error;
}

module.exports = {
  updateOrder,
  getOrder,
};
