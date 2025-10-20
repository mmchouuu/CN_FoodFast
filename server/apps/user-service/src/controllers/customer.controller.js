// user-service/src/controllers/customer.controller.js

const customerService = require('../services/customer.service');

function getUserId(req) {
  return req.headers['x-user-id'] || (req.body && req.body.user_id) || null;
}

async function register(req, res, next) {
  try {
    const result = await customerService.registerCustomer(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await customerService.verifyCustomer(email, otp);
    res.json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await customerService.loginCustomer(req.body);
    res.json(result);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
}

async function listAddresses(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'missing user context' });
    }
    const result = await customerService.listAddresses(userId);
    res.json(result);
  } catch (err) { next(err); }
}

async function createAddress(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'missing user context' });
    }
    const created = await customerService.createAddress(userId, req.body || {});
    res.status(201).json(created);
  } catch (err) { next(err); }
}

async function deleteAddress(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'missing user context' });
    }
    const deleted = await customerService.deleteAddress(userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'not found' });
    }
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { register, verify, login, listAddresses, createAddress, deleteAddress };
