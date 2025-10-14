// user-service/src/controllers/customer.controller.js

const customerService = require('../services/customer.service');

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
  } catch (err) { next(err); }
}

module.exports = { register, verify, login };