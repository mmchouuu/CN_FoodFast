const axios = require('axios');
const crypto = require('crypto');
const https = require('https');
const config = require('../config');

const MOMO_ENDPOINTS = {
  create: '/v2/gateway/api/create',
  query: '/v2/gateway/api/query',
  refund: '/v2/gateway/api/refund',
};

const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: true,
});

const ensureConfig = () => {
  const { partnerCode, accessKey, secretKey } = config.MOMO || {};
  if (!partnerCode || !accessKey || !secretKey) {
    const error = new Error('MoMo credentials are not configured');
    error.statusCode = 500;
    throw error;
  }
  return { partnerCode, accessKey, secretKey };
};

const getApiBase = () => (config.MOMO?.apiBase || 'https://test-payment.momo.vn').replace(/\/+$/, '');

const normalizeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('amount must be greater than 0'), { statusCode: 400 });
  }
  return Math.round(amount).toString();
};

const sign = (rawSignature, secretKey) =>
  crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

const encodeExtraData = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return Buffer.from(value, 'utf8').toString('base64');
  }
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
};

async function createPaymentRequest({
  orderId,
  requestId,
  amount,
  orderInfo,
  redirectUrl = config.MOMO?.redirectUrl,
  ipnUrl = config.MOMO?.ipnUrl,
  extraData,
  requestType = 'captureWallet',
  lang = 'vi',
}) {
  const { partnerCode, accessKey, secretKey } = ensureConfig();

  if (!orderId) {
    throw Object.assign(new Error('orderId is required'), { statusCode: 400 });
  }

  const normalizedAmount = normalizeAmount(amount);
  const payload = {
    partnerCode,
    partnerName: 'FoodFast',
    storeId: 'FoodFast',
    requestId: requestId || `${partnerCode}-${Date.now()}`,
    amount: normalizedAmount,
    orderId,
    orderInfo: orderInfo || `Order ${orderId}`,
    redirectUrl: redirectUrl || config.MOMO?.redirectUrl,
    ipnUrl: ipnUrl || config.MOMO?.ipnUrl,
    lang,
    extraData: encodeExtraData(extraData),
    requestType,
    autoCapture: true,
    orderGroupId: '',
  };

  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData}`,
    `ipnUrl=${payload.ipnUrl}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${payload.redirectUrl}`,
    `requestId=${payload.requestId}`,
    `requestType=${payload.requestType}`,
  ].join('&');

  payload.signature = sign(rawSignature, secretKey);

  const { data } = await axios.post(`${getApiBase()}${MOMO_ENDPOINTS.create}`, payload, {
    httpsAgent,
  });
  return data;
}

async function queryTransaction({ orderId, requestId }) {
  const { partnerCode, accessKey, secretKey } = ensureConfig();
  if (!orderId) {
    throw Object.assign(new Error('orderId is required'), { statusCode: 400 });
  }
  const body = {
    partnerCode,
    requestId: requestId || `${partnerCode}-${Date.now()}`,
    orderId,
    lang: 'vi',
  };
  const rawSignature = [
    `accessKey=${accessKey}`,
    `orderId=${body.orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${body.requestId}`,
  ].join('&');
  body.signature = sign(rawSignature, secretKey);

  const { data } = await axios.post(`${getApiBase()}${MOMO_ENDPOINTS.query}`, body, {
    httpsAgent,
  });
  return data;
}

async function refundTransaction({ orderId, requestId, amount, transId, description = 'FoodFast refund' }) {
  const { partnerCode, accessKey, secretKey } = ensureConfig();
  if (!transId) {
    throw Object.assign(new Error('MoMo transId is required for refund'), { statusCode: 400 });
  }
  const normalizedAmount = normalizeAmount(amount);
  const body = {
    partnerCode,
    requestId: requestId || `${partnerCode}-${Date.now()}`,
    orderId: orderId || `${partnerCode}-${Date.now()}`,
    amount: normalizedAmount,
    transId,
    lang: 'vi',
    description,
  };
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${body.amount}`,
    `description=${body.description}`,
    `orderId=${body.orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${body.requestId}`,
    `transId=${body.transId}`,
  ].join('&');
  body.signature = sign(rawSignature, secretKey);

  const { data } = await axios.post(`${getApiBase()}${MOMO_ENDPOINTS.refund}`, body, {
    httpsAgent,
  });
  return data;
}

function verifyIpnSignature(payload = {}) {
  const { secretKey } = ensureConfig();
  if (!payload.signature) return false;
  const fields = [
    'accessKey',
    'amount',
    'extraData',
    'message',
    'orderId',
    'orderInfo',
    'orderType',
    'partnerCode',
    'payType',
    'requestId',
    'responseTime',
    'resultCode',
    'transId',
  ];
  const rawSignature = fields
    .map((field) => `${field}=${payload[field] ?? ''}`)
    .join('&');
  const expected = sign(rawSignature, secretKey);
  return expected === payload.signature;
}

function decodeExtraData(encoded) {
  if (!encoded) return null;
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

module.exports = {
  createPaymentRequest,
  queryTransaction,
  refundTransaction,
  verifyIpnSignature,
  decodeExtraData,
};
