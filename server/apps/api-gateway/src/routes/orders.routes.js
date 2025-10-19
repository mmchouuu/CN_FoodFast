const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();
const jwt = require('jsonwebtoken');

const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

// auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({error:'no token'});
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
    target: ORDER_SERVICE,
    changeOrigin: true,
    pathRewrite: (path) => {
      const suffix = !path || path === '/' ? '' : path;
      return `/api/orders${suffix}`;
    },
    onError: (err, req, res) =>
      res.status(502).json({ error: 'bad gateway', detail: err.message }),
  })
);

module.exports = router;
