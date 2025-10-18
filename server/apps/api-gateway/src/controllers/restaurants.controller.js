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
    const { email, otp, activationPassword, newPassword } = req.body;
    if (!email || !otp || !activationPassword || !newPassword) {
      return res.status(400).json({ message: 'email, otp, activationPassword and newPassword are required' });
    }
    const result = await restaurantClient.verify(
      { email, otp, activationPassword, newPassword },
      { headers: { 'x-request-id': req.id }},
    );
    return res.json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await restaurantClient.login(req.body, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

async function status(req, res, next) {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }
    const result = await restaurantClient.status(email, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

async function ownerAccount(req, res, next) {
  try {
    const { id } = req.params;
    const result = await restaurantClient.ownerAccount(id, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

module.exports = { register, verify, login, status, ownerAccount };
