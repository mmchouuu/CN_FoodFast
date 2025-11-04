const ordersService = require('../services/orders.service');

function mapError(res, error) {
  const status =
    error?.status ||
    error?.httpStatus ||
    (error?.name === 'ValidationError' ? 400 : null) ||
    (error?.name === 'NotFoundError' ? 404 : null) ||
    (error?.name === 'ForbiddenError' ? 403 : null) ||
    500;

  const payload = {
    error: error?.message || 'Internal server error',
  };

  if (error?.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

exports.createOrder = async (req, res) => {
  try {
    const order = await ordersService.createCustomerOrder({
      user: req.user,
      payload: req.body,
      context: {
        authorization: req.headers.authorization,
        requestId: req.headers['x-request-id'],
      },
    });
    return res.status(201).json(order);
  } catch (error) {
    console.error('[order-service] createOrder failed:', error);
    return mapError(res, error);
  }
};

exports.listOrders = async (req, res) => {
  try {
    const result = await ordersService.listCustomerOrders({
      user: req.user,
      query: req.query,
    });
    return res.json(result);
  } catch (error) {
    console.error('[order-service] listOrders failed:', error);
    return mapError(res, error);
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await ordersService.getCustomerOrder({
      user: req.user,
      orderId: req.params.id,
    });
    if (!order) {
      return res.status(404).json({ error: 'order not found' });
    }
    return res.json(order);
  } catch (error) {
    console.error('[order-service] getOrder failed:', error);
    return mapError(res, error);
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const result = await ordersService.cancelCustomerOrder({
      user: req.user,
      orderId: req.params.id,
      payload: req.body,
    });
    return res.json(result);
  } catch (error) {
    console.error('[order-service] cancelOrder failed:', error);
    return mapError(res, error);
  }
};
