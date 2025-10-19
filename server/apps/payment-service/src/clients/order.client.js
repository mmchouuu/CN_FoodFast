const axios = require('axios');

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://order-service:3003';
const ORDER_SERVICE_TIMEOUT = Number(process.env.ORDER_SERVICE_TIMEOUT || 5000);

const client = axios.create({
  baseURL: ORDER_SERVICE_URL,
  timeout: ORDER_SERVICE_TIMEOUT,
});

async function updateOrderPayment(orderId, payload, authorization) {
  if (!orderId) throw new Error('orderId is required');
  if (!authorization) throw new Error('authorization header missing');

  try {
    const response = await client.patch(
      `/api/orders/${orderId}/payment`,
      payload,
      {
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (err) {
    const error = new Error(
      err.response?.data?.error || 'failed to update order payment'
    );
    error.status = err.response?.status || 502;
    error.data = err.response?.data;
    throw error;
  }
}

module.exports = { updateOrderPayment };
