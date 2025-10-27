const customerService = require('../services/customer.service');

function getUserId(req) {
  return req.user?.userId || req.headers['x-user-id'] || null;
}

async function register(req, res, next) {
  try {
    const result = await customerService.registerCustomer(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function verify(req, res, next) {
  try {
    const { email, otp } = req.body || {};
    const result = await customerService.verifyCustomer(email, otp);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await customerService.loginCustomer(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listAddresses(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const addresses = await customerService.listAddresses(userId);
    res.json({ items: addresses });
  } catch (error) {
    next(error);
  }
}

async function createAddress(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const created = await customerService.createAddress(userId, req.body || {});
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

async function updateAddress(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { id } = req.params;
    const updated = await customerService.updateAddress(userId, id, req.body || {});
    if (!updated) {
      return res.status(404).json({ message: 'Address not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

async function deleteAddress(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { id } = req.params;
    const deleted = await customerService.deleteAddress(userId, id);
    if (!deleted) {
      return res.status(404).json({ message: 'Address not found' });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    const result = await customerService.requestPasswordReset(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await customerService.resetPassword(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  verify,
  login,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  forgotPassword,
  resetPassword,
};
