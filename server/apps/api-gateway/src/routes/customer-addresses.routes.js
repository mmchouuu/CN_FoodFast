const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const router = express.Router();

const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://user-service:3001';

function authMiddleware(req, res, next) {
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
