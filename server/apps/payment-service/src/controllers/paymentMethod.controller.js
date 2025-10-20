const paymentMethodService = require('../services/paymentMethod.service');

function getUserId(req) {
  return req.headers['x-user-id'] || req.body?.user_id || null;
}

async function listBankAccounts(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'missing user context' });
    }
    const accounts = await paymentMethodService.listBankAccounts(userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}

async function createBankAccount(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'missing user context' });
    }
    const account = await paymentMethodService.createBankAccount(userId, req.body || {});
    res.status(201).json(account);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
}

module.exports = {
  listBankAccounts,
  createBankAccount,
};
