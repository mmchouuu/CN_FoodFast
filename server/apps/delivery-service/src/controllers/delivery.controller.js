const deliveryService = require('../services/delivery.service');
const deliveriesAdminService = require('../services/deliveries.service');
const orderAssignmentService = require('../services/orderAssignment.service');

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

const parseOrderIds = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length);
  }
  return [];
};

async function listAdminDeliveries(req, res, next) {
  try {
    const ids = parseOrderIds(req.query.orderIds || req.query.order_ids);
    const { status, limit } = req.query || {};

    // When orderIds are provided, return the specific deliveries (legacy path used by assignment view)
    if (ids.length) {
      const data = await deliveriesAdminService.getDeliveriesByOrderIds(ids);
      return res.json({ data });
    }

    // Fallback: allow admin to list deliveries by status/limit for tracking view
    const result = await deliveryService.listDeliveries({ status, limit });
    return res.json({
      data: result.items,
      limit: result.limit,
      total: result.total,
      metrics: result.metrics,
    });
  } catch (error) {
    next(error);
  }
}

async function assignDelivery(req, res, next) {
  try {
    const { deliveryId } = req.params;
    const { droneId, orderId } = req.body || {};
    if (!deliveryId && !orderId) {
      return res.status(400).json({ error: 'deliveryId or orderId is required' });
    }
    if (!droneId) {
      return res.status(400).json({ error: 'droneId is required' });
    }
    const assignedBy =
      req.headers['x-user-id'] ||
      req.headers['x-owner-id'] ||
      req.headers['x-admin-id'] ||
      null;
    const result = await deliveriesAdminService.assignDelivery({
      deliveryId,
      orderId,
      droneId,
      assignedBy,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function reprocessOrderAssignment(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderAssignmentService.reprocessOrder(orderId);
    res.json({ status: 'ok', orderId });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDeliveries,
  getStatus,
  listAdminDeliveries,
  assignDelivery,
  reprocessOrderAssignment,
};
