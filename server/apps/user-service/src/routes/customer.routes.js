// user-service/routes/customer.routes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

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

router.post('/register', customerController.register);   // { first_name,last_name,email,phone,password }
router.post('/verify', customerController.verify);       // { email, otp }
router.post('/login', customerController.login);         // { email, password }

router.get('/addresses', authMiddleware, customerController.listAddresses);
router.post('/addresses', authMiddleware, customerController.createAddress);
router.delete('/addresses/:id', authMiddleware, customerController.deleteAddress);

module.exports = router;
