const ordersService = require('../services/orders.service');

function mapError(res, error) {
  const status =
    error?.status ||
    error?.httpStatus ||
    (error?.name === 'ValidationError' ? 400 : null) ||
    (error?.name === 'ForbiddenError' ? 403 : null) ||
    (error?.name === 'NotFoundError' ? 404 : null) ||
    500;

  const payload = {
    error: error?.message || 'Internal server error',
  };

  if (error?.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

exports.listOrders = async (req, res) => {
  try {
    const result = await ordersService.listAdminOrders({
      user: req.user,
      query: req.query,
    });
    return res.json(result);
  } catch (error) {
    console.error('[order-service] admin listOrders failed:', error);
    return mapError(res, error);
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await ordersService.getAdminOrder({
      user: req.user,
      orderId: req.params.id,
    });
    if (!order) {
      return res.status(404).json({ error: 'order not found' });
    }
    return res.json(order);
  } catch (error) {
    console.error('[order-service] admin getOrder failed:', error);
    return mapError(res, error);
  }
};

exports.patchOrder = async (req, res) => {
  try {
    const updated = await ordersService.patchAdminOrder({
      user: req.user,
      orderId: req.params.id,
      payload: req.body,
    });
    return res.json(updated);
  } catch (error) {
    console.error('[order-service] admin patchOrder failed:', error);
    return mapError(res, error);
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const result = await ordersService.deleteAdminOrder({
      user: req.user,
      orderId: req.params.id,
      payload: req.body,
    });
    return res.json(result);
  } catch (error) {
    console.error('[order-service] admin deleteOrder failed:', error);
    return mapError(res, error);
  }
};

exports.listAssignmentOrders = async (req, res) => {
  try {
    const hubId = req.query?.hubId || req.query?.hub_id;
    const limit = req.query?.limit;
    const offset = req.query?.offset;
    const data = await ordersService.listAssignmentOrders({
      hubId,
      limit,
      offset,
    });
    return res.json({ data });
  } catch (error) {
    console.error('[order-service] admin listAssignmentOrders failed:', error);
    return mapError(res, error);
  }
};

exports.listPendingAssignmentOrders = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 500);
    const result = await ordersService.listPendingAssignmentOrders({ limit });
    return res.json({ data: result.items, total: result.total });
  } catch (error) {
    console.error('[order-service] admin listPendingAssignmentOrders failed:', error);
    return mapError(res, error);
  }
};
