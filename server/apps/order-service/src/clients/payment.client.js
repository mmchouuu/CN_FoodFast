const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';
const REQUEST_TIMEOUT =
  Number.isFinite(Number(process.env.PAYMENT_SERVICE_TIMEOUT))
    ? Number(process.env.PAYMENT_SERVICE_TIMEOUT)
    : 7000;

function sendJsonRequest(path, { method = 'GET', body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(path, BASE_URL);
    const transport = targetUrl.protocol === 'https:' ? https : http;

    const options = {
      method,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: REQUEST_TIMEOUT,
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (!data) {
          resolve({ status: res.statusCode, data: null });
          return;
        }
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (err) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('payment-service request timeout'));
    });

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(payload);
    }

    req.end();
  });
}

async function lookupPayments(orderIds = []) {
  if (!Array.isArray(orderIds) || !orderIds.length) {
    return [];
  }

  try {
    const { status, data } = await sendJsonRequest('/internal/payments/lookup', {
      method: 'POST',
      body: { order_ids: orderIds },
    });

    if (status >= 200 && status < 300 && data) {
      if (Array.isArray(data.payments)) return data.payments;
      if (Array.isArray(data)) return data;
      return [];
    }

    throw new Error(
      (data && (data.error || data.message)) || `payment-service responded with ${status}`,
    );
  } catch (error) {
    console.error('[order-service] Failed to lookup payments:', error.message || error);
    return [];
  }
}

async function createRefund({
  paymentId,
  amount,
  reason,
  idempotencyKey = null,
  userId = null,
}) {
  if (!paymentId || amount === undefined || amount === null) {
    throw new Error('paymentId and amount are required to create a refund');
  }

  const payload = {
    payment_id: paymentId,
    amount,
    reason: reason || null,
  };

  if (idempotencyKey) {
    payload.idempotency_key = idempotencyKey;
  }

  const headers = {};
  if (userId) {
    headers['x-user-id'] = userId;
  }

  const invoke = async (path) =>
    sendJsonRequest(path, {
      method: 'POST',
      body: payload,
      headers,
    });

  let response = await invoke('/api/payments/refunds');

  // Fallback for older routing (without /api/payments prefix)
  if (response.status === 404) {
    response = await invoke('/refunds');
  }

  const { status, data } = response;

  if (status >= 200 && status < 300) {
    return data;
  }

  const errorMessage =
    (data && (data.error || data.message)) ||
    `payment-service responded with ${status}`;
  const error = new Error(errorMessage);
  error.status = status;
  throw error;
}

async function confirmCashPayment({ orderId, userId }) {
  if (!orderId) {
    throw new Error('orderId is required to confirm cash payment');
  }

  const payload = {
    order_id: orderId,
    user_id: userId || null,
  };

  try {
    const { status, data } = await sendJsonRequest('/internal/payments/confirm-cash', {
      method: 'POST',
      body: payload,
    });

    if (status >= 200 && status < 300) {
      return data?.payment || data || null;
    }

    throw new Error((data && data.error) || `payment-service responded with ${status}`);
  } catch (error) {
    console.error('[order-service] Failed to confirm cash payment:', error.message || error);
    throw error;
  }
}

module.exports = {
  lookupPayments,
  createRefund,
  confirmCashPayment,
};
