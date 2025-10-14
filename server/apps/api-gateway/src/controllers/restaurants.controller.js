// api-gateway/src/controllers/restaurants.controller.js
const restaurantClient = require('../services/restaurant.client');

async function register(req, res, next) {
  try {
    const payload = req.body;
    if (!payload.email || !payload.password) return res.status(400).json({ message: 'email and password required' });
    const result = await restaurantClient.register(payload, { headers: { 'x-request-id': req.id }});
    return res.status(201).json(result);
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await restaurantClient.verify({ email, otp }, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await restaurantClient.login(req.body, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

module.exports = { register, verify, login };
