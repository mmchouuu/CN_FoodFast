const payoutsService = require('../services/payouts.admin.service');

const mapError = (res, error) => {
  const status = error?.status || error?.statusCode || error?.httpStatus || 500;
  return res.status(status).json({
    error: error?.message || 'Internal server error',
    details: error?.details || undefined,
  });
};

exports.listSettlements = async (req, res) => {
  try {
    const restaurantId = req.query.restaurant_id;
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' });
    }
    const result = await payoutsService.listRestaurantSettlements({
      restaurantId,
      branchId: req.query.branch_id,
      status: req.query.status,
      search: req.query.search,
      period: req.query.period,
      range: req.query.range,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] owner listSettlements failed:', error);
    return mapError(res, error);
  }
};

exports.listSettlementOrders = async (req, res) => {
  try {
    const restaurantId = req.query.restaurant_id;
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' });
    }
    const result = await payoutsService.listSettlementOrders(req.params.settlementId, {
      restaurantId,
    });
    if (!result) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    return res.json(result);
  } catch (error) {
    console.error('[payment-service] owner listSettlementOrders failed:', error);
    return mapError(res, error);
  }
};
