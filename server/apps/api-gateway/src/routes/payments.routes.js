const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();
const jwt = require('jsonwebtoken');

const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';

// auth middleware
function authMiddleware(req, res, next) {
  const directUserId =
    req.headers['x-user-id'] ||
    req.body?.user_id ||
    req.query?.user_id;

  if (directUserId) {
    req.user = {
      userId: directUserId,
      role: req.body?.role || 'customer',
    };
    return next();
  }

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

router.use('/', authMiddleware, createProxyMiddleware({
  target: PAYMENT_SERVICE,
  changeOrigin: true,
  pathRewrite: { '^/api/payments': '/api/payments' },
  onProxyReq(proxyReq, req) {
    if (req.user?.userId) {
      proxyReq.setHeader('x-user-id', req.user.userId);
    }
  },
  onError: (err, req, res) => res.status(502).json({ error: 'bad gateway', detail: err.message })
}));


module.exports = router;
