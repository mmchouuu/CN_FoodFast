const express = require('express');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const attachOwnerContext = require('../middlewares/ownerContext');
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
      if (req.ownerContext?.ownerId) {
        proxyReq.setHeader('x-owner-id', req.ownerContext.ownerId);
      }
      if (req.ownerContext?.restaurantIds?.length) {
        proxyReq.setHeader('x-restaurant-ids', req.ownerContext.restaurantIds.join(','));
      }
      if (req.ownerContext?.branchIds?.length) {
        proxyReq.setHeader('x-branch-ids', req.ownerContext.branchIds.join(','));
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
};

const ownerOrdersProxy = proxy(`${ORDER_SERVICE_URL}/owner/orders`);

router.patch('/:id/status', attachOwnerContext, async (req, res) => {
  const ownerId = req.ownerContext?.ownerId;
  if (!ownerId) {
    return res.status(401).json({ error: 'owner identity required' });
  }

  const orderId = req.params.id;
  const status = req.body?.status;
  if (!orderId || !status) {
    return res.status(400).json({ error: 'order id and status are required' });
  }

  const targetUrl = `${ORDER_SERVICE_URL}/owner/orders/${orderId}/status`;
  const headers = {
    'x-owner-id': ownerId,
  };
  if (req.ownerContext?.restaurantIds?.length) {
    headers['x-restaurant-ids'] = req.ownerContext.restaurantIds.join(',');
  }
  if (req.ownerContext?.branchIds?.length) {
    headers['x-branch-ids'] = req.ownerContext.branchIds.join(',');
  }
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  try {
    const response = await axios.patch(
      targetUrl,
      { status, note: req.body?.note || null },
      { headers },
    );
    return res.json(response.data);
  } catch (error) {
    const statusCode = error?.response?.status || 500;
    const payload = error?.response?.data || { error: error.message || 'Failed to update order' };
    return res.status(statusCode).json(payload);
  }
});

router.use(attachOwnerContext, ownerOrdersProxy);

module.exports = router;
