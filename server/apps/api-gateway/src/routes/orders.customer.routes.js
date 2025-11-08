const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const router = express.Router();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

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

const customerOrdersProxy = proxy(`${ORDER_SERVICE_URL}/customer/orders`);

router.post('/', customerOrdersProxy);
router.get('/', customerOrdersProxy);
router.get('/:id', customerOrdersProxy);
router.post('/:id/cancel', customerOrdersProxy);

module.exports = router;
