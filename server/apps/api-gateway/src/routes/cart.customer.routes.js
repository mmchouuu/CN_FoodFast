const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const forwardProxyBody = require('../utils/forwardProxyBody');

const router = express.Router();

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

const CART_PREFIX = '/customer/cart';

const buildProxyPath = (req) => {
  const base = req.baseUrl || CART_PREFIX;
  const suffix = req.url || '';
  return `${base}${suffix}`.replace(/\/{2,}/g, '/');
};

const ensureCustomerIdentity = (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  const candidate =
    req.headers['x-customer-id'] ||
    req.headers['x-user-id'] ||
    req.headers['x-cart-id'] ||
    req.headers['x-guest-id'] ||
    req.query?.customerId ||
    req.query?.customer_id ||
    req.query?.userId ||
    req.query?.user_id ||
    req.query?.cartId ||
    req.query?.cart_id ||
    req.body?.customerId ||
    req.body?.customer_id ||
    req.body?.userId ||
    req.body?.user_id ||
    req.body?.cartId ||
    req.body?.cart_id;

  if (candidate) {
    req.customerIdentity = {
      userId: String(candidate).trim(),
      role: 'customer',
    };
    return next();
  }

  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  return res.status(401).json({ error: 'customer identity required' });
};

const customerCartProxy = createProxyMiddleware({
  target: ORDER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (_path, req) => buildProxyPath(req),
  onProxyReq: (proxyReq, req) => {
    if (req.customerIdentity?.userId) {
      proxyReq.setHeader('x-user-id', req.customerIdentity.userId);
      proxyReq.setHeader('x-user-role', req.customerIdentity.role || 'customer');
    }
    forwardProxyBody(proxyReq, req);
  },
  onError: (err, _req, res) => {
    if (res.headersSent) return;
    res.status(502).json({
      error: 'order-service unavailable',
      detail: err.message,
    });
  },
});

router.get('/', ensureCustomerIdentity, customerCartProxy);
router.post('/', ensureCustomerIdentity, customerCartProxy);
router.put('/', ensureCustomerIdentity, customerCartProxy);
router.delete('/', ensureCustomerIdentity, customerCartProxy);

module.exports = router;
