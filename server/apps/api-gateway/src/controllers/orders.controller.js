const orderClient = require('../services/order.client');

const buildHeaders = (req) => ({
  'x-request-id': req.id,
  authorization: req.headers.authorization,
});

exports.listOrders = async (req, res, next) => {
  try {
    const data = await orderClient.listOrders({
      headers: buildHeaders(req),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.listOrdersByUser = async (req, res, next) => {
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
};

exports.getOrderById = async (req, res, next) => {
  try {
    const data = await orderClient.getOrderById(req.params.id, {
      headers: buildHeaders(req),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
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
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'order id is required' });
    }
    const { status } = req.body || {};
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
};
