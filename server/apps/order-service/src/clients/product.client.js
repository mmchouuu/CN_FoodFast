const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
const REQUEST_TIMEOUT =
  Number.isFinite(Number(process.env.PRODUCT_SERVICE_TIMEOUT))
    ? Number(process.env.PRODUCT_SERVICE_TIMEOUT)
    : 7000;

const jsonHeaders = {
  'Content-Type': 'application/json',
};

function sendJsonRequest(urlString, { method = 'GET', headers = {}, body = null, timeout = REQUEST_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(urlString, BASE_URL);
    const transport = targetUrl.protocol === 'https:' ? https : http;

    const options = {
      method,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: {
        ...jsonHeaders,
        ...headers,
      },
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
    req.setTimeout(timeout, () => {
      req.destroy(new Error('product-service request timeout'));
    });

    if (body) {
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(raw);
    }

    req.end();
  });
}

async function quoteOrderPricing(payload, { authorization } = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload is required for quoteOrderPricing');
  }

  const headers = {};
  if (authorization) {
    headers.Authorization = authorization;
  }

  const { status, data } = await sendJsonRequest('/internal/orders/pricing', {
    method: 'POST',
    headers,
    body: payload,
  });

  if (status >= 200 && status < 300) {
    return data;
  }

  const error = new Error(
    (data && (data.error || data.message)) || 'failed to compute pricing from product-service',
  );
  error.status = status;
  error.data = data;
  throw error;
}

async function fetchBranchById(branchId) {
  if (!branchId) {
    throw new Error('branchId is required');
  }
  const { status, data } = await sendJsonRequest(`/api/restaurants/branches/by-id/${branchId}`, {
    method: 'GET',
  });
  if (status === 404) return null;
  if (status >= 200 && status < 300) {
    return data;
  }
  const error = new Error(
    (data && (data.error || data.message)) || 'failed to load branch from product-service',
  );
  error.status = status;
  throw error;
}

async function listRestaurantsByOwner(ownerId) {
  if (!ownerId) {
    return [];
  }

  const { status, data } = await sendJsonRequest(`/api/restaurants/owner/${ownerId}/list`, {
    method: 'GET',
  });

  if (status >= 200 && status < 300) {
    if (Array.isArray(data?.items)) {
      return data.items;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  const error = new Error(
    (data && (data.error || data.message)) ||
      'failed to load restaurants by owner from product-service',
  );
  error.status = status;
  error.data = data;
  throw error;
}

module.exports = {
  quoteOrderPricing,
  fetchBranchById,
  listRestaurantsByOwner,
};

