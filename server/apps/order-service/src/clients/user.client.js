const http = require('http');
const https = require('https');
const { URL } = require('url');

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || 'http://user-service:3001';
const USER_SERVICE_TIMEOUT = Number(process.env.USER_SERVICE_TIMEOUT || 5000);

function requestJson(urlString, { method = 'GET', headers = {}, timeout = USER_SERVICE_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(urlString, USER_SERVICE_URL);
    const transport = requestUrl.protocol === 'https:' ? https : http;
    const options = {
      method,
      hostname: requestUrl.hostname,
      port: requestUrl.port || (requestUrl.protocol === 'https:' ? 443 : 80),
      path: `${requestUrl.pathname}${requestUrl.search}`,
      headers,
    };

    let settled = false;
    const req = transport.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (settled) return;
        settled = true;
        if (!body) {
          resolve({ status: res.statusCode, data: null });
          return;
        }
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });

    req.setTimeout(
      Number.isFinite(timeout) && timeout > 0 ? timeout : USER_SERVICE_TIMEOUT,
      () => {
        if (settled) return;
        settled = true;
        req.destroy();
        reject(new Error('user-service request timeout'));
      }
    );

    req.end();
  });
}

async function getAddressById(addressId, authorization) {
  if (!addressId) {
    const error = new Error('addressId is required');
    error.status = 400;
    throw error;
  }
  if (!authorization) {
    const error = new Error('authorization header missing');
    error.status = 401;
    throw error;
  }

  const { status, data } = await requestJson(
    `/api/customers/me/addresses/${addressId}`,
    {
      method: 'GET',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
    }
  );

  if (status === 404) {
    return null;
  }

  if (status >= 200 && status < 300) {
    return data;
  }

  const error = new Error(
    (data && (data.error || data.message)) || 'failed to load address'
  );
  error.status = status || 502;
  error.data = data;
  throw error;
}

module.exports = { getAddressById };
