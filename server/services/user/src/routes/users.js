const express = require('express');
const { User, Address } = require('../models');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const u = await User.findByPk(id, { include: [{ model: Address, as: 'addresses' }] });
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json(u);
});

router.post('/:id/addresses', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { street, ward, district, city, is_primary } = req.body;
  const addr = await Address.create({ user_id: id, street, ward, district, city, is_primary });
  res.status(201).json(addr);
});

module.exports = router;