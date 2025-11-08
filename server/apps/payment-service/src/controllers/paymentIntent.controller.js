// payment-service/src/controllers/paymentMethod.controller.js

const checkoutService = require('../services/checkout.service');

const resolveUserId = (req, body = {}) =>
  req.user?.id ||
  req.user?.userId ||
  req.headers['x-user-id'] ||
  body.user_id ||
  body.userId ||
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

exports.createIntent = async (req, res) => {
  const body = req.body || {};
  try {
    const userId = resolveUserId(req, body);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const intent = await checkoutService.createIntent({
      userId,
      provider: body.provider || body.channel || 'stripe',
      orderId: body.order_id || body.orderId,
      amount: body.amount,
      currency: body.currency,
      description: body.description,
      metadata: body.metadata,
      restaurantId: body.restaurant_id || body.restaurantId,
      branchId: body.branch_id || body.branchId,
      paymentMethodId: body.payment_method_id || body.paymentMethodId,
      walletId: body.wallet_id || body.walletId,
      redirectUrl: body.redirect_url || body.redirectUrl,
      ipnUrl: body.ipn_url || body.ipnUrl,
      receiptEmail: body.receipt_email || body.receiptEmail || req.user?.email,
      customerName: body.customer_name || body.customerName || req.user?.name,
    });

    return res.status(201).json(intent);
  } catch (error) {
    console.error('[payment-service] createIntent failed:', error);
    return mapError(res, error);
  }
};

exports.confirmPayment = async (req, res) => {
  const body = req.body || {};
  try {
    const result = await checkoutService.confirmPayment({
      provider: body.provider || body.channel || 'stripe',
      paymentIntentId: body.payment_intent_id || body.paymentIntentId,
      orderId: body.order_id || body.orderId,
      requestId: body.request_id || body.requestId,
    });
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] confirmPayment failed:', error);
    return mapError(res, error);
  }
};
