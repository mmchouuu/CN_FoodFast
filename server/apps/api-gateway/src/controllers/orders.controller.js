// api-gateway/src/controllers/orders.controller.js
const orderClient = require('../services/order.client');

// Hợp nhất: kết hợp buildHeaders và forwardHeaders
function buildHeaders(req) {
  const headers = {
    'x-request-id': req.id,
  };

  if (req.headers.authorization) {
    headers.authorization = req.headers.authorization;
  }

  if (req.headers['x-correlation-id']) {
    headers['x-correlation-id'] = req.headers['x-correlation-id'];
  }

  return headers;
}

// ----------------------------------------------------------------------
// List all orders
// ----------------------------------------------------------------------
async function listOrders(req, res, next) {
  try {
    const data = await orderClient.listOrders({
      params: req.query,
      headers: buildHeaders(req),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// ----------------------------------------------------------------------
// List orders by user (giữ nguyên logic xác thực user)
// ----------------------------------------------------------------------
async function listOrdersByUser(req, res, next) {
  try {
    const { userId } = req.params;
    const tokenUserId = req.user?.userId ? String(req.user.userId) : null;
    const resolvedUserId = userId ? String(userId) : tokenUserId;

    if (!resolvedUserId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (tokenUserId && resolvedUserId !== tokenUserId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const data = await orderClient.listOrdersByUser(resolvedUserId, {
      headers: buildHeaders(req),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// ----------------------------------------------------------------------
// Get order by ID
// ----------------------------------------------------------------------
async function getOrderById(req, res, next) {
  try {
    const data = await orderClient.getOrderById(req.params.id || req.params.orderId, {
      headers: buildHeaders(req),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// ----------------------------------------------------------------------
// Create order
// ----------------------------------------------------------------------
async function createOrder(req, res, next) {
  try {
    const payload = { ...(req.body || {}) };
    const userId = req.user?.userId;
    if (userId) {
      payload.user_id = payload.user_id || userId;
      payload.userId = payload.userId || userId;
    }

    const data = await orderClient.createOrder(payload, {
      headers: buildHeaders(req),
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

// ----------------------------------------------------------------------
// Update order status
// ----------------------------------------------------------------------
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'order id is required' });
    }
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const data = await orderClient.updateOrderStatus(id, status, {
      headers: buildHeaders(req),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  listOrdersByUser,
  getOrderById,
  createOrder,
  updateOrderStatus,
};
