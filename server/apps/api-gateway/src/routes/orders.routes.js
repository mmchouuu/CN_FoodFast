const express = require('express');
const jwt = require('jsonwebtoken');
const OrdersController = require('../controllers/orders.controller');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'no token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

router.use(authMiddleware);

router.get('/', OrdersController.listOrders);
router.get('/user/:userId', OrdersController.listOrdersByUser);
router.get('/:id', OrdersController.getOrderById);
router.post('/', OrdersController.createOrder);
router.put('/:id/status', OrdersController.updateOrderStatus);

module.exports = router;
