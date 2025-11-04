const OrderService = require('../services/order.service');

const respondWithError = (res, error) => {
  const status =
    Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;
  const message =
    status >= 500
      ? 'Internal server error'
      : error?.message || 'Request validation failed';

  if (status >= 500) {
    console.error('[order-service] controller error:', error);
  }

  return res.status(status).json({ error: message });
};

exports.getAllOrders = async (_req, res) => {
  try {
    const orders = await OrderService.getAllOrders();
    res.json(orders);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await OrderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.createOrder = async (req, res) => {
  try {
    const payload = req.body || {};
    const userIdFromToken =
      req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub || null;
    const totalAmount = payload.total_amount ?? payload.totalAmount;

    if (totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ error: 'total_amount is required' });
    }

    const normalizedUserId = userIdFromToken || payload.user_id || payload.userId;

    if (!normalizedUserId) {
      return res.status(400).json({ error: 'User context is missing' });
    }

    const normalizedPaymentMethod =
      typeof payload.payment_method === 'string'
        ? payload.payment_method
        : typeof payload.paymentMethod === 'string'
        ? payload.paymentMethod
        : typeof payload.payment?.method === 'string'
        ? payload.payment.method
        : null;

    const selectedAddress =
      payload.selectedAddress ||
      payload.selected_address ||
      payload.delivery_address ||
      payload.shipping_address ||
      null;

    const orderPayload = {
      ...payload,
      user_id: normalizedUserId,
    };

    if (selectedAddress) {
      orderPayload.selectedAddress = selectedAddress;
    }

    if (normalizedPaymentMethod) {
      orderPayload.payment_method = normalizedPaymentMethod;
    }

    const order = await OrderService.createOrder(
      orderPayload,
      req.user || null,
    );
    res.status(201).json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await OrderService.updateOrderStatus(req.params.id, req.body.status);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const result = await OrderService.deleteOrder(req.params.id);
    res.json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.getOrdersByUser = async (req, res) => {
  try {
    const orders = await OrderService.getOrdersByUserId(req.params.userId);
    res.json(orders);
  } catch (error) {
    respondWithError(res, error);
  }
};
