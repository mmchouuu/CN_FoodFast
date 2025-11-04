const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const router = express.Router();

const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';

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
      // ignore JSON parse failure
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
};

const parseRoles = (...values) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => parseList(value))
        .map((role) => role.toLowerCase())
        .filter((role) => role.length),
    ),
  );

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

    const primaryRole = roles.length ? roles[0] : 'customer';

    req.user = {
      id: directUserId,
      userId: directUserId,
      role: primaryRole,
    };

    if (roles.length) {
      req.user.roles = roles;
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
  if (!authHeader) return res.status(401).json({ error: 'no token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

router.use(
  '/',
  authMiddleware,
  createProxyMiddleware({
    target: PAYMENT_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/api/payments': '/api/payments' },
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
    onError: (err, req, res) =>
      res.status(502).json({ error: 'bad gateway', detail: err.message }),
  }),
);

module.exports = router;
