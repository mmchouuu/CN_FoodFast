const express = require('express');
const { Product } = require('../models');
const router = express.Router();

router.post('/', async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

router.get('/', async (req, res) => {
  const products = await Product.findAll();
  res.json(products);
});

router.get('/:id', async (req, res) => {
  const p = await Product.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

module.exports = router;
