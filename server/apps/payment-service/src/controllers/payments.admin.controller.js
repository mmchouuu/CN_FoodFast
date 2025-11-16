const paymentsService = require('../services/payments.service');
const refundsService = require('../services/refunds.service');
const payoutsAdminService = require('../services/payouts.admin.service');

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

exports.listPayoutRestaurants = async (req, res) => {
  try {
    const result = await payoutsAdminService.listRestaurantPayouts(req.query || {});
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] listPayoutRestaurants failed:', error);
    return mapError(res, error);
  }
};

exports.listPayoutBranches = async (req, res) => {
  try {
    const result = await payoutsAdminService.listRestaurantBranchSettlements(
      req.params.restaurantId,
      req.query || {},
    );
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] listPayoutBranches failed:', error);
    return mapError(res, error);
  }
};

exports.listSettlementOrders = async (req, res) => {
  try {
    const result = await payoutsAdminService.listSettlementOrders(req.params.settlementId);
    if (!result) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] listSettlementOrders failed:', error);
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
