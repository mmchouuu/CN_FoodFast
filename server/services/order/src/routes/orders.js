const express = require('express');
const { Order, OrderItem } = require('../models');
const router = express.Router();

// create new order
router.post('/', async (req, res) => {
  const { user_id, items, total_amount } = req.body;
  const order = await Order.create({ user_id, total_amount });
  if (items && items.length > 0) {
    for (const it of items) {
      await OrderItem.create({ ...it, order_id: order.id });
    }
  }
  res.status(201).json(order);
});

// get order with items
router.get('/:id', async (req, res) => {
  const o = await Order.findByPk(req.params.id, { include: ['items'] });
  if (!o) return res.status(404).json({ error: 'not found' });
  res.json(o);
});

module.exports = router;
