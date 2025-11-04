const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const router = express.Router();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

const toStringOrNull = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const parseList = (value) => {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === undefined || item === null ? null : String(item).trim()))
      .filter((item) => item && item.length);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item === undefined || item === null ? null : String(item).trim()))
          .filter((item) => item && item.length);
      }
    } catch (error) {
      // ignore JSON parsing failure, fall through
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
};

const parseRoles = (...values) => {
  const aggregated = [];
  values.forEach((value) => aggregated.push(...parseList(value)));
  return Array.from(
    new Set(
      aggregated
        .map((role) => role.toLowerCase())
        .filter((role) => role.length),
    ),
  );
};

function authMiddleware(req, res, next) {
  const directUserId =
    toStringOrNull(req.headers['x-user-id']) ||
    toStringOrNull(req.body?.user_id) ||
    toStringOrNull(req.body?.userId) ||
    toStringOrNull(req.query?.user_id) ||
    toStringOrNull(req.query?.userId);

  if (directUserId) {
    const roles = parseRoles(
      req.headers['x-user-role'],
      req.headers['x-user-roles'],
      req.body?.role,
      req.body?.roles,
      req.query?.role,
      req.query?.roles,
    );
    const primaryRole = roles.length ? roles[0] : 'owner';

    const restaurantIds = parseList(
      req.headers['x-restaurant-ids'],
      req.body?.restaurant_ids,
      req.body?.restaurantIds,
      req.query?.restaurant_ids,
      req.query?.restaurantIds,
    );

    const branchIds = parseList(
      req.headers['x-branch-ids'],
      req.body?.branch_ids,
      req.body?.branchIds,
      req.query?.branch_ids,
      req.query?.branchIds,
    );

    req.user = {
      id: directUserId,
      userId: directUserId,
      role: primaryRole,
    };

    if (roles.length) {
      req.user.roles = roles;
    }

    if (restaurantIds.length) {
      req.user.restaurant_ids = restaurantIds;
      req.user.restaurantIds = restaurantIds;
    }

    if (branchIds.length) {
      req.user.branch_ids = branchIds;
      req.user.branchIds = branchIds;
    }

    if (req.body?.name || req.headers['x-user-name']) {
      req.user.name = toStringOrNull(req.body?.name) || toStringOrNull(req.headers['x-user-name']);
    }

    if (req.body?.email || req.headers['x-user-email']) {
      req.user.email =
        toStringOrNull(req.body?.email) || toStringOrNull(req.headers['x-user-email']);
    }

    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'no token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

const proxy = (target) => {
  const url = new URL(target);
  const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;

  return createProxyMiddleware({
    target: url.origin,
    changeOrigin: true,
    pathRewrite: (path) => `${basePath}${path === '/' ? '' : path}`,
    onProxyReq(proxyReq, req) {
      if (req.user?.userId) {
        proxyReq.setHeader('x-user-id', req.user.userId);
      }
      if (req.user?.role) {
        proxyReq.setHeader('x-user-role', req.user.role);
      }
      if (Array.isArray(req.user?.roles) && req.user.roles.length) {
        proxyReq.setHeader('x-user-roles', JSON.stringify(req.user.roles));
      }
      if (Array.isArray(req.user?.restaurant_ids) && req.user.restaurant_ids.length) {
        proxyReq.setHeader('x-restaurant-ids', JSON.stringify(req.user.restaurant_ids));
      }
      if (Array.isArray(req.user?.branch_ids) && req.user.branch_ids.length) {
        proxyReq.setHeader('x-branch-ids', JSON.stringify(req.user.branch_ids));
      }
      if (req.user?.email) {
        proxyReq.setHeader('x-user-email', req.user.email);
      }
      if (req.user?.name) {
        proxyReq.setHeader('x-user-name', req.user.name);
      }
      if (
        req.body &&
        Object.keys(req.body).length &&
        req.headers['content-type']?.includes('application/json') &&
        ['POST', 'PUT', 'PATCH'].includes(req.method?.toUpperCase())
      ) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
        proxyReq.end();
      }
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

const ownerOrdersProxy = proxy(`${ORDER_SERVICE_URL}/owner/orders`);

router.use(authMiddleware);
router.get('/', ownerOrdersProxy);
router.get('/:id', ownerOrdersProxy);
router.patch('/:id/status', ownerOrdersProxy);
router.post('/:id/revisions', ownerOrdersProxy);

module.exports = router;
