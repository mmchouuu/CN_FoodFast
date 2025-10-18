// api-gateway/src/controllers/customers.controller.js
const customerClient = require('../services/customer.client');

async function register(req, res, next) {
  try {
    const payload = req.body;
    if (!payload.email || !payload.password)
      return res.status(400).json({ message: 'email and password required' });

    const result = await customerClient.register(payload, {
      headers: { 'x-request-id': req.id }
    });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await customerClient.verify({ email, otp }, {
      headers: { 'x-request-id': req.id }
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await customerClient.login(req.body, {
      headers: { 'x-request-id': req.id }
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email is required' });
    const result = await customerClient.requestPasswordReset({ email }, {
      headers: { 'x-request-id': req.id }
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ message: 'email, otp and new_password are required' });
    }
    const result = await customerClient.resetPassword({ email, otp, new_password }, {
      headers: { 'x-request-id': req.id }
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verify, login, requestPasswordReset, resetPassword };
