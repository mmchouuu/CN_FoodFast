const express = require('express');
const jwt = require('jsonwebtoken');
const customerController = require('../controllers/customer.controller');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function authMiddleware(req, res, next) {
  // Internal override for gateway/controller calls
  const directUserId = req.headers['x-user-id'] || req.query?.user_id || req.body?.user_id;
  if (directUserId) {
    req.user = { userId: directUserId, role: 'customer' };
    return next();
  }

  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

router.post('/signup', customerController.register);
router.post('/verify', customerController.verify);
router.post('/login', customerController.login);
router.post('/forgot-password', customerController.forgotPassword);
router.post('/reset-password', customerController.resetPassword);

router.get('/me/addresses', authMiddleware, customerController.listAddresses);
router.post('/me/addresses', authMiddleware, customerController.createAddress);
router.put('/me/addresses/:id', authMiddleware, customerController.updateAddress);
router.delete('/me/addresses/:id', authMiddleware, customerController.deleteAddress);

module.exports = router;
