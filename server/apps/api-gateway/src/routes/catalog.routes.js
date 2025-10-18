const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const router = express.Router();

const PRODUCT_SERVICE =
  process.env.PRODUCT_SERVICE_URL
  || (process.env.NODE_ENV === 'production' ? 'http://product-service:3002' : 'http://localhost:3002');

router.use(
  '/',
  createProxyMiddleware({
    target: PRODUCT_SERVICE,
    changeOrigin: true,
    pathRewrite: {
      '^/api/catalog/restaurants': '/api/catalog/restaurants',
    },
    onError: (err, req, res) => res.status(502).json({ error: 'bad gateway', detail: err.message }),
  }),
);

module.exports = router;
