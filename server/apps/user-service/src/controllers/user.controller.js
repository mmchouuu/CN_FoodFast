// user-service/src/controllers/user.controller.js
const userService = require('../services/user.service');

async function register(req, res, next) {
  try {
    const result = await userService.register(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await userService.verifyOTP(email, otp);
    res.json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await userService.login(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function getAll(req, res, next) {
  try {
    const result = await userService.getAllUsers();
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { register, verify, login, getAll };
