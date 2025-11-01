// api-gateway/src/controllers/orders.controller.js
const orderClient = require('../services/order.client');

const forwardHeaders = (req) => {
  const headers = {
    'x-request-id': req.id,
  };

  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  if (req.headers['x-correlation-id']) {
    headers['x-correlation-id'] = req.headers['x-correlation-id'];
  }

  return headers;
};

async function listOrders(req, res, next) {
  try {
    const headers = forwardHeaders(req);
    const data = await orderClient.listOrders({
      params: req.query,
      headers,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    const headers = forwardHeaders(req);
    const data = await orderClient.getOrderById(req.params.orderId, { headers });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createOrder(req, res, next) {
  try {
    const headers = forwardHeaders(req);
    const data = await orderClient.createOrder(req.body, { headers });
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
};
