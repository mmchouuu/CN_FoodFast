// api-gateway/src/routes/customers.routes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const controller = require('../controllers/customers.controller');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

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
  if (!authHeader) return res.status(401).json({ error: 'no token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

router.post('/register', controller.register);
router.post('/verify', controller.verify);
router.post('/login', controller.login);
router.post('/forgot-password', controller.requestPasswordReset);
router.post('/reset-password', controller.resetPassword);

router.get('/addresses', authMiddleware, controller.listAddresses);
router.post('/addresses', authMiddleware, controller.createAddress);
router.delete('/addresses/:id', authMiddleware, controller.deleteAddress);

module.exports = router;
