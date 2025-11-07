const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('../config');

const router = express.Router();

const ORDER_SERVICE_URL = (
  process.env.ORDER_SERVICE_URL ||
  config.orderServiceUrl ||
  'http://localhost:3003'
).replace(/\/+$/, '');

const proxy = (target) => {
  const url = new URL(target);
  const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;

  return createProxyMiddleware({
    target: url.origin,
    changeOrigin: true,
    pathRewrite: (path) => `${basePath}${path === '/' ? '' : path}`,
    onError: (err, req, res) => {
      if (res.headersSent) return;
      res.status(502).json({
        error: 'order-service unavailable',
        detail: err.message,
      });
    },
  });
};

const adminOrdersProxy = proxy(`${ORDER_SERVICE_URL}/admin/orders`);

router.get('/', adminOrdersProxy);
router.get('/:id', adminOrdersProxy);
router.patch('/:id', adminOrdersProxy);
router.delete('/:id', adminOrdersProxy);

module.exports = router;
