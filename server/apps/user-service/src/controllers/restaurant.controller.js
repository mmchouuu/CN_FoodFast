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
    const { email, otp, password } = req.body;
    const result = await restaurantService.verifyRestaurant(email, otp, password);
    res.json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await restaurantService.loginRestaurant(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { register, verify, login };
