const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';

router.use('/', createProxyMiddleware({
  target: PRODUCT_SERVICE,
  changeOrigin: true,
  pathRewrite: { '^/api/products': '/api/products' },
  onError: (err, req, res) => res.status(502).json({ error: 'bad gateway', detail: err.message })
}));

module.exports = router;
