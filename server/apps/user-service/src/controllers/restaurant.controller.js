const restaurantService = require('../services/restaurant.service');

async function register(req, res, next) {
  try {
    const result = await restaurantService.registerOwner(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function verify(req, res, next) {
  try {
    const result = await restaurantService.verifyOwner(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await restaurantService.ownerLogin(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function status(req, res, next) {
  try {
    const { email } = req.query;
    const result = await restaurantService.getOwnerStatus(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createOwnerMainAccount(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const payload = { ...req.body, restaurantId };
    const result = await restaurantService.createOwnerMainAccount(payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function createMember(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const result = await restaurantService.createRestaurantMember({
      ...req.body,
      restaurantId,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function setPassword(req, res, next) {
  try {
    const result = await restaurantService.setOwnerPassword(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function resendVerification(req, res, next) {
  try {
    const { email } = req.body || {};
    const result = await restaurantService.resendOwnerVerification({ email });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  verify,
  login,
  status,
  createOwnerMainAccount,
  createMember,
  setPassword,
  resendVerification,
};
