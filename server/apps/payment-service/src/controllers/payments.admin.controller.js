const paymentsService = require('../services/payments.service');
const refundsService = require('../services/refunds.service');

const mapError = (res, error) => {
  const status = error?.status || error?.statusCode || error?.httpStatus || 500;
  return res.status(status).json({
    error: error?.message || 'Internal server error',
    details: error?.details || undefined,
  });
};

exports.listPayments = async (req, res) => {
  try {
    const result = await paymentsService.listPayments({
      status: req.query.status,
      flow: req.query.flow,
      restaurantId: req.query.restaurant_id,
      userId: req.query.user_id,
      limit: Number(req.query.limit) || 20,
      offset: Number(req.query.offset) || 0,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] listPayments failed:', error);
    return mapError(res, error);
  }
};

exports.listRefunds = async (req, res) => {
  try {
    const result = await refundsService.listRefunds({
      status: req.query.status,
      restaurantId: req.query.restaurant_id,
      paymentId: req.query.payment_id,
      limit: Number(req.query.limit) || 20,
      offset: Number(req.query.offset) || 0,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] listRefunds failed:', error);
    return mapError(res, error);
  }
};
