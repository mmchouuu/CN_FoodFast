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
    const result = await ordersService.listOwnerOrders({
      user: req.user,
      query: req.query,
    });
    return res.json(result);
  } catch (error) {
    console.error('[order-service] owner listOrders failed:', error);
    return mapError(res, error);
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await ordersService.getOwnerOrder({
      user: req.user,
      orderId: req.params.id,
    });
    if (!order) {
      return res.status(404).json({ error: 'order not found' });
    }
    return res.json(order);
  } catch (error) {
    console.error('[order-service] owner getOrder failed:', error);
    return mapError(res, error);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const result = await ordersService.updateOwnerOrderStatus({
      user: req.user,
      orderId: req.params.id,
      payload: req.body,
    });
    return res.json(result);
  } catch (error) {
    console.error('[order-service] owner updateStatus failed:', error);
    return mapError(res, error);
  }
};

exports.createRevision = async (req, res) => {
  try {
    const revision = await ordersService.createOwnerOrderRevision({
      user: req.user,
      orderId: req.params.id,
      payload: req.body,
    });
    return res.status(201).json(revision);
  } catch (error) {
    console.error('[order-service] owner createRevision failed:', error);
    return mapError(res, error);
  }
};
