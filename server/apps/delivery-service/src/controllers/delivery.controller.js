const deliveryService = require('../services/delivery.service');

async function listDeliveries(req, res, next) {
  try {
    const { limit, status } = req.query;
    const result = await deliveryService.listDeliveries({ limit, status });
    res.json({
      data: result.items,
      limit: result.limit,
      total: result.total,
      metrics: result.metrics,
    });
  } catch (error) {
    next(error);
  }
}

async function getStatus(_req, res, next) {
  try {
    const status = await deliveryService.getSystemStatus();
    res.json({
      service: 'delivery-service',
      status,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDeliveries,
  getStatus,
};
