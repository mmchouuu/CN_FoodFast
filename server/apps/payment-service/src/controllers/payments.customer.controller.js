const paymentMethodsService = require('../services/paymentMethods.service');

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

exports.createStripeSetupIntent = async (req, res) => {
  try {
    const result = await paymentMethodsService.createStripeSetupIntent({
      userId: req.user?.id || req.user?.userId,
      email: req.user?.email,
      name: req.user?.name,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('[payment-service] createStripeSetupIntent failed:', error);
    return mapError(res, error);
  }
};

exports.confirmStripePaymentMethod = async (req, res) => {
  const body = req.body || {};
  try {
    const record = await paymentMethodsService.confirmStripePaymentMethod({
      userId: req.user?.id || req.user?.userId,
      paymentMethodId: body.payment_method_id,
      customerId: body.customer_id,
      makeDefault: paymentMethodsService.sanitizeBoolean(body.make_default),
    });
    return res.status(201).json(record);
  } catch (error) {
    console.error('[payment-service] confirmStripePaymentMethod failed:', error);
    return mapError(res, error);
  }
};

exports.listPaymentMethods = async (req, res) => {
  try {
    const methods = await paymentMethodsService.listCustomerPaymentMethods(
      req.user?.id || req.user?.userId,
    );
    return res.json({ data: methods });
  } catch (error) {
    console.error('[payment-service] listPaymentMethods failed:', error);
    return mapError(res, error);
  }
};
