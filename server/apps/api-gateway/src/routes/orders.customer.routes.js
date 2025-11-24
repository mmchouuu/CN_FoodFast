const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const forwardProxyBody = require('../utils/forwardProxyBody');

const router = express.Router();

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

const CUSTOMER_PREFIX = '/customer/orders';

const buildProxyPath = (req) => {
  const base = req.baseUrl || CUSTOMER_PREFIX;
  const suffix = req.url || '';
  return `${base}${suffix}`.replace(/\/{2,}/g, '/');
};

const customerOrdersProxy = createProxyMiddleware({
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

const ensureCustomerIdentity = (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  const candidate =
    req.headers['x-customer-id'] ||
    req.headers['x-user-id'] ||
    req.query?.customerId ||
    req.query?.customer_id ||
    req.query?.userId ||
    req.query?.user_id ||
    req.body?.customerId ||
    req.body?.customer_id ||
    req.body?.userId ||
    req.body?.user_id;

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

router.post('/', ensureCustomerIdentity, customerOrdersProxy);
router.get('/', ensureCustomerIdentity, customerOrdersProxy);
router.get('/cart', ensureCustomerIdentity, customerOrdersProxy);
router.put('/cart', ensureCustomerIdentity, customerOrdersProxy);
router.delete('/cart', ensureCustomerIdentity, customerOrdersProxy);
router.get('/:id', ensureCustomerIdentity, customerOrdersProxy);
router.post('/:id/cancel', ensureCustomerIdentity, customerOrdersProxy);
router.post('/:id/complete', ensureCustomerIdentity, customerOrdersProxy);
router.patch('/:id/status', ensureCustomerIdentity, customerOrdersProxy);
router.put('/:id/status', ensureCustomerIdentity, customerOrdersProxy);

module.exports = router;
