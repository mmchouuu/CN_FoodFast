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

function sendJsonRequest(
  urlString,
  { method = 'GET', headers = {}, body = null, timeout = REQUEST_TIMEOUT } = {},
) {
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

async function fetchBranchCatalog(restaurantId, branchId, { authorization } = {}) {
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }

  const headers = {};
  if (authorization) {
    headers.Authorization = authorization;
  }

  const querySuffix = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  const { status, data } = await sendJsonRequest(
    `/restaurants/${encodeURIComponent(restaurantId)}/catalog${querySuffix}`,
    {
      method: 'GET',
      headers,
    },
  );

  if (status >= 200 && status < 300) {
    return data;
  }

  const error = new Error(
    (data && (data.error || data.message)) || 'failed to load branch catalog from product-service',
  );
  error.status = status;
  error.data = data;
  throw error;
}

module.exports = {
  quoteOrderPricing,
  fetchBranchCatalog,
};
