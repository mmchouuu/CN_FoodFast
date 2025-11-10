const express = require('express');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const config = require('../config');
const restaurantClient = require('../services/restaurant.client');
const forwardProxyBody = require('../utils/forwardProxyBody');

const router = express.Router();

const ORDER_SERVICE_URL = (
  process.env.ORDER_SERVICE_URL ||
  config.orderServiceUrl ||
  'http://localhost:3003'
).replace(/\/+$/, '');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

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

const parseScopeHeader = (value) => {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((entry) => entry.trim()).filter(Boolean);
};

async function attachOwnerContext(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let ownerId = null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      ownerId = payload.userId || payload.user_id || payload.id || null;
    } catch (error) {
      if (!req.headers['x-owner-id']) {
        return res.status(401).json({ error: 'invalid token' });
      }
    }
  }

  if (!ownerId) {
    ownerId =
      req.headers['x-owner-id'] ||
      req.query?.ownerId ||
      req.body?.ownerId ||
      null;
  }

  if (!ownerId) {
    return res.status(401).json({ error: 'owner identity required' });
  }

  let restaurantIds = parseScopeHeader(req.headers['x-restaurant-ids']);

  if (!restaurantIds.length) {
    try {
      const response = await restaurantClient.listRestaurantsByOwner(ownerId, {
        headers: { 'x-request-id': req.id },
      });
      const items = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : [];
      restaurantIds = items
        .map((item) => item?.id || item?.restaurant_id)
        .filter(Boolean)
        .map((value) => String(value));
    } catch (error) {
      console.error('[gateway → owner orders] failed to resolve restaurant scope:', error.message);
      return res.status(502).json({ error: 'failed to resolve owner restaurant scope' });
    }
  }

  req.ownerContext = {
    ownerId: String(ownerId),
    restaurantIds: Array.from(new Set(restaurantIds)),
  };

  return next();
}

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
