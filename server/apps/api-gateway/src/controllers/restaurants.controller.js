// api-gateway/src/controllers/restaurants.controller.js
const restaurantClient = require('../services/restaurant.client');

async function register(req, res, next) {
  try {
    const payload = req.body;
    const required = ['restaurantName', 'companyAddress', 'taxCode', 'managerName', 'email'];
    const missing = required.filter((field) => !payload[field]);
    if (missing.length) {
      return res.status(400).json({ message: `missing fields: ${missing.join(', ')}` });
    }
    const result = await restaurantClient.register(payload, { headers: { 'x-request-id': req.id }});
    return res.status(201).json(result);
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'email, otp and password are required' });
    }
    const result = await restaurantClient.verify({ email, otp, password }, { headers: { 'x-request-id': req.id }});
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
