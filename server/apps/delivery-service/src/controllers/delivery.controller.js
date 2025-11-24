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
    if (!ids.length) {
      return res.json({ data: [] });
    }
    const data = await deliveriesAdminService.getDeliveriesByOrderIds(ids);
    res.json({ data });
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

const extractCustomerId = (req) =>
  req.headers['x-customer-id'] ||
  req.headers['x-user-id'] ||
  req.query.customerId ||
  req.query.customer_id ||
  req.customerIdentity?.userId ||
  null;

async function getCustomerDelivery(req, res, next) {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }
    const customerId = extractCustomerId(req);
    const delivery = await deliveriesAdminService.getCustomerDelivery(orderId, customerId);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    res.json({ data: delivery });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
}

async function getCustomerDeliveryLogs(req, res, next) {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }
    const customerId = extractCustomerId(req);
    const telemetry = await deliveriesAdminService.getCustomerDeliveryLogs(orderId, customerId, {
      limit: req.query.limit,
    });
    res.json(telemetry);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
}

module.exports = {
  listDeliveries,
  getStatus,
  listAdminDeliveries,
  assignDelivery,
  reprocessOrderAssignment,
  getCustomerDelivery,
  getCustomerDeliveryLogs,
};
