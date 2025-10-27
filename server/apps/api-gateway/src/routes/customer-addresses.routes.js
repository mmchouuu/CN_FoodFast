const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const router = express.Router();

const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://user-service:3001';

function authMiddleware(req, res, next) {
  const directUserId =
    req.headers['x-user-id'] ||
    req.query?.user_id ||
    req.body?.user_id;

  if (directUserId) {
    req.user = { userId: directUserId, role: 'customer' };
    req.headers['x-user-id'] = directUserId;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'no token' });

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'invalid token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = payload;
    if (payload?.userId) {
      req.headers['x-user-id'] = payload.userId;
    } else {
      delete req.headers['x-user-id'];
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

router.use(
  '/',
  authMiddleware,
  createProxyMiddleware({
    target: USER_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => {
      const suffix = path === '/' ? '' : path;
      return `/api/customers/me/addresses${suffix}`;
    },
    onError: (err, req, res) =>
      res.status(502).json({ error: 'bad gateway', detail: err.message }),
  })
);

module.exports = router;
