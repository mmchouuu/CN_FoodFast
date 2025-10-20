const orderService = require('../services/orders.service');

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

exports.listOrders = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(400).json({ error: 'unable to resolve current user' });
  }

  const limit = Math.min(toPositiveInt(req.query.limit, 50), 100);
  const offset = toPositiveInt(req.query.offset, 0);

  try {
    const orders = await orderService.listOrders({ userId, limit, offset });
    return res.json(orders);
  } catch (error) {
    console.error('[order-service] Failed to list orders:', error);
    return res.status(500).json({ error: 'failed to load orders' });
  }
};

exports.getOrderById = async (req, res) => {
  const userId = req.user?.id;
  const { orderId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'unable to resolve current user' });
  }

  if (!orderId) {
    return res.status(400).json({ error: 'order id is required' });
  }

  try {
    const order = await orderService.getOrderById({ orderId, userId });
    if (!order) {
      return res.status(404).json({ error: 'order not found' });
    }
    return res.json(order);
  } catch (error) {
    console.error('[order-service] Failed to load order:', error);
    return res.status(500).json({ error: 'failed to load order' });
  }
};

exports.createOrder = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(400).json({ error: 'unable to resolve current user' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};

  if (!payload.restaurant_id) {
    return res.status(400).json({ error: 'restaurant_id is required' });
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return res.status(400).json({ error: 'order items are required' });
  }

  try {
    const created = await orderService.createOrder({ userId, payload });
    return res.status(201).json(created);
  } catch (error) {
    console.error('[order-service] Failed to create order:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'failed to create order' });
  }
};
