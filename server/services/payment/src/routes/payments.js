const express = require('express');
const { Payment } = require('../models');
const { publishPaymentEvent } = require('../utils/publisher');

const router = express.Router();

// create payment (initiate)
router.post('/', async (req, res) => {
  const { order_id, payment_method_id, amount, currency } = req.body;
  const p = await Payment.create({ order_id, payment_method_id, amount, currency, status: 'pending' });
  // In a real system: call external gateway -> await result or return redirect
  // For now return pending and rely on webhook to update
  res.status(201).json(p);
});

// get payment
router.get('/:id', async (req, res) => {
  const p = await Payment.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

module.exports = router;
