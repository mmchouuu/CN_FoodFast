const express = require('express');
const { PaymentMethod } = require('../models');

const router = express.Router();

// create payment method
router.post('/', async (req, res) => {
  const { user_id, type, provider_token, last4, brand, exp_month, exp_year } = req.body;
  const pm = await PaymentMethod.create({ user_id, type, provider_token, last4, brand, exp_month, exp_year });
  res.status(201).json(pm);
});

// list by user
router.get('/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const methods = await PaymentMethod.findAll({ where: { user_id }});
  res.json(methods);
});

module.exports = router;
