const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const forwardProxyBody = require('../utils/forwardProxyBody');

const router = express.Router();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

const proxy = (target) => {
  const url = new URL(target);
  const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;

  return createProxyMiddleware({
    target: url.origin,
    changeOrigin: true,
    pathRewrite: (path) => `${basePath}${path === '/' ? '' : path}`,
    onProxyReq: (proxyReq, req) => {
      if (req.customerIdentity?.userId) {
        proxyReq.setHeader('x-user-id', req.customerIdentity.userId);
        if (req.customerIdentity.role) {
          proxyReq.setHeader('x-user-role', req.customerIdentity.role);
        }
      }
      forwardProxyBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      if (res.headersSent) return;
      res.status(502).json({
        error: 'order-service unavailable',
        detail: err.message,
      });
    },
  });
};

const customerOrdersProxy = proxy(`${ORDER_SERVICE_URL}/customer/orders`);

const ensureCustomerIdentity = (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  // Always accept explicit identity hints (headers/query/body), even if Bearer exists.
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

  // If no explicit hint and we do have a Bearer, let downstream JWT auth handle it.
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  return res.status(401).json({ error: 'customer identity required' });
};

router.post('/', ensureCustomerIdentity, customerOrdersProxy);
router.get('/', ensureCustomerIdentity, customerOrdersProxy);
router.get('/:id', ensureCustomerIdentity, customerOrdersProxy);
router.post('/:id/cancel', ensureCustomerIdentity, customerOrdersProxy);
router.post('/:id/complete', ensureCustomerIdentity, customerOrdersProxy);

module.exports = router;
