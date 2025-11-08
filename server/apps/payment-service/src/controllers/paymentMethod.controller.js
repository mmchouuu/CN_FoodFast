const paymentMethodService = require('../services/paymentMethod.service');
const paymentMethodsService = require('../services/paymentMethods.service');

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

exports.listPaymentMethods = async (req, res) => {
  try {
    const userId = resolveUserId(req, req.query);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }
    const type = (req.query?.type || '').toLowerCase();
    if (type === 'wallet') {
      const wallets = await paymentMethodService.listWallets(userId);
      return res.json({ wallets });
    }
    if (type === 'card') {
      const cards = await paymentMethodsService.listCustomerPaymentMethods(userId);
      return res.json({ cards });
    }
    const [wallets, cards] = await Promise.all([
      paymentMethodService.listWallets(userId),
      paymentMethodsService.listCustomerPaymentMethods(userId),
    ]);
    return res.json({ wallets, cards });
  } catch (error) {
    console.error('[payment-service] listPaymentMethods failed:', error);
    return mapError(res, error);
  }
};

exports.createPaymentMethod = async (req, res) => {
  const body = req.body || {};
  try {
    const userId = resolveUserId(req, req.query);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const type = (body.type || body.provider_type || body.payment_type || '').toLowerCase();
    if (type === 'wallet' || body.provider === 'momo') {
      const record = await paymentMethodService.createWallet(userId, body);
      return res.status(201).json(record);
    }
    if (type === 'card' || body.provider === 'stripe') {
      if (!body.payment_method_id || !body.customer_id) {
        return res.status(400).json({
          error: 'payment_method_id and customer_id are required for card methods',
        });
      }
      const record = await paymentMethodsService.confirmStripePaymentMethod({
        userId,
        paymentMethodId: body.payment_method_id,
        customerId: body.customer_id,
        makeDefault: paymentMethodsService.sanitizeBoolean(body.make_default ?? body.isDefault),
      });
      return res.status(201).json(record);
    }
    return res.status(400).json({ error: 'Unsupported payment method type' });
  } catch (error) {
    console.error('[payment-service] createPaymentMethod failed:', error);
    return mapError(res, error);
  }
};

exports.listWallets = async (req, res) => {
  try {
    const userId = resolveUserId(req, req.query);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const data = await paymentMethodService.listWallets(userId);
    return res.json({ wallets: data });
  } catch (error) {
    console.error('[payment-service] listWallets failed:', error);
    return mapError(res, error);
  }
};

exports.createWallet = async (req, res) => {
  const body = req.body || {};
  try {
    const userId = resolveUserId(req, body);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const record = await paymentMethodService.createWallet(userId, body);
    return res.status(201).json(record);
  } catch (error) {
    console.error('[payment-service] createWallet failed:', error);
    return mapError(res, error);
  }
};

exports.listBankAccounts = exports.listWallets;
exports.createBankAccount = exports.createWallet;

