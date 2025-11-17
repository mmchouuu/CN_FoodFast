const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const forwardProxyBody = require('../utils/forwardProxyBody');

const router = express.Router();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

// Tạo proxy chuẩn
const buildCustomerOrdersProxy = () =>
  createProxyMiddleware({
    target: ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => {
      return path
        .replace(/^\/api\/orders\/customer\/orders/, '/customer/orders')
        .replace(/^\/api\/orders\/customer/, '/customer/orders')
        .replace(/^\/customer\/orders/, '/customer/orders');
    },

    onProxyReq: (proxyReq, req) => {
      if (req.customerIdentity?.userId) {
        proxyReq.setHeader('x-user-id', req.customerIdentity.userId);
        proxyReq.setHeader('x-user-role', 'customer');
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

const customerOrdersProxy = buildCustomerOrdersProxy();

// Xác thực user
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

// const customerOrdersProxy = proxy(`${ORDER_SERVICE_URL}/customer/orders`);

// const ensureCustomerIdentity = (req, res, next) => {
//   const authHeader = req.headers.authorization || '';

//   // Always accept explicit identity hints (headers/query/body), even if Bearer exists.
//   const candidate =
//     req.headers['x-customer-id'] ||
//     req.headers['x-user-id'] ||
//     req.query?.customerId ||
//     req.query?.customer_id ||
//     req.query?.userId ||
//     req.query?.user_id ||
//     req.body?.customerId ||
//     req.body?.customer_id ||
//     req.body?.userId ||
//     req.body?.user_id;

//   if (candidate) {
//     req.customerIdentity = {
//       userId: String(candidate).trim(),
//       role: 'customer',
//     };
//     return next();
//   }

//   // If no explicit hint and we do have a Bearer, let downstream JWT auth handle it.
//   if (authHeader.startsWith('Bearer ')) {
//     return next();
//   }

//   return res.status(401).json({ error: 'customer identity required' });
// };


// Áp dụng route
router.post('/', ensureCustomerIdentity, customerOrdersProxy);
router.get('/', ensureCustomerIdentity, customerOrdersProxy);
router.get('/:id', ensureCustomerIdentity, customerOrdersProxy);
router.post('/:id/cancel', ensureCustomerIdentity, customerOrdersProxy);
router.post('/:id/complete', ensureCustomerIdentity, customerOrdersProxy);
router.patch('/:id/status', ensureCustomerIdentity, customerOrdersProxy);
router.put('/:id/status', ensureCustomerIdentity, customerOrdersProxy);

module.exports = router;
