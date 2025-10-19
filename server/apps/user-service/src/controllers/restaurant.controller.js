// user-service/src/controllers/restaurant.controller.js

const restaurantService = require('../services/restaurant.service');

async function register(req, res, next) {
  try {
    const result = await restaurantService.registerRestaurant(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const {
      email,
      otp,
      activationPassword,
      newPassword,
    } = req.body;
    const result = await restaurantService.verifyRestaurant({
      email,
      otp_code: otp,
      activationPassword,
      newPassword,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await restaurantService.loginRestaurant(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function getStatus(req, res, next) {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const status = await restaurantService.getRestaurantStatus(email);
    res.json(status);
  } catch (err) { next(err); }
}

async function getOwnerAccount(req, res, next) {
  try {
    const { id } = req.params;
    const account = await restaurantService.getRestaurantAccountById(id);
    res.json(account);
  } catch (err) {
    if (err.message === 'Restaurant not found') {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
}

module.exports = {
  register,
  verify,
  login,
  getStatus,
  getOwnerAccount,
};
