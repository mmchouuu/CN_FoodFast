const paymentMethodService = require('../services/paymentMethod.service');

const resolveUserId = (req, body = {}) =>
  req.user?.id ||
  req.user?.userId ||
  req.user?.user_id ||
  req.headers['x-user-id'] ||
  req.headers['x-userid'] ||
  body.user_id ||
  body.userId ||
  req.query?.user_id ||
  req.query?.userId ||
  null;

const mapError = (res, error) => {
  const status =
    error?.statusCode ||
    error?.status ||
    error?.httpStatus ||
    (error?.name === 'ValidationError' ? 400 : 500);

  return res.status(status).json({
    error: error?.message || 'Internal server error',
    details: error?.details || undefined,
  });
};

exports.listBankAccounts = async (req, res) => {
  try {
    const userId = resolveUserId(req, req.query);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const data = await paymentMethodService.listBankAccounts(userId);
    return res.json({ data });
  } catch (error) {
    console.error('[payment-service] listBankAccounts failed:', error);
    return mapError(res, error);
  }
};

exports.createBankAccount = async (req, res) => {
  const body = req.body || {};
  try {
    const userId = resolveUserId(req, body);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const record = await paymentMethodService.createBankAccount(userId, body);
    return res.status(201).json(record);
  } catch (error) {
    console.error('[payment-service] createBankAccount failed:', error);
    return mapError(res, error);
  }
};
