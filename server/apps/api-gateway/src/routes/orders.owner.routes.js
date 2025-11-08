const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const config = require('../config');
const restaurantClient = require('../services/restaurant.client');

const router = express.Router();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

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

async function attachOwnerContext(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'no token provided' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'invalid token' });
  }

  const ownerId = payload.userId || payload.user_id || payload.id;
  if (!ownerId) {
    return res.status(403).json({ error: 'missing owner identity' });
  }

  let restaurantIds = [];
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

  req.ownerContext = {
    ownerId: String(ownerId),
    restaurantIds: Array.from(new Set(restaurantIds)),
  };

  return next();
}

router.use(attachOwnerContext, ownerOrdersProxy);

module.exports = router;
