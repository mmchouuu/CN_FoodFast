const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { first_name, last_name, email, phone, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: 'email exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ first_name, last_name, email, phone, password_hash: hash, role });
  res.status(201).json({ id: user.id, email: user.email });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  res.json({ access_token: token, user: { id: user.id, email: user.email, role: user.role } });
});

module.exports = router;