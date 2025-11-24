const express = require('express');
const axios = require('axios');
const config = require('../config');

const router = express.Router();

const DELIVERY_SERVICE_URL = config.deliveryServiceUrl || process.env.DELIVERY_SERVICE_URL;
const BASE_URL = `${DELIVERY_SERVICE_URL}/api/deliveries/customer`;

const http = axios.create({
  timeout: config.requestTimeout,
});

const ensureCustomerIdentity = (req, res, next) => {
  const candidate =
    req.headers['x-customer-id'] ||
    req.headers['x-user-id'] ||
    req.query?.customerId ||
    req.query?.customer_id ||
    req.body?.customerId ||
    req.body?.customer_id;

  if (candidate) {
    req.customerIdentity = {
      userId: String(candidate).trim(),
      role: 'customer',
    };
    return next();
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  return res.status(401).json({ error: 'customer identity required' });
};

const buildHeaders = (req) => {
  const headers = {};
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  if (req.customerIdentity?.userId) {
    headers['x-customer-id'] = req.customerIdentity.userId;
    headers['x-user-id'] = req.customerIdentity.userId;
    headers['x-user-role'] = req.customerIdentity.role || 'customer';
  }
  return headers;
};

router.get('/orders/:orderId', ensureCustomerIdentity, async (req, res) => {
  try {
    const params = {};
    if (req.customerIdentity?.userId) {
      params.customerId = req.customerIdentity.userId;
    } else if (req.query?.customerId || req.query?.customer_id) {
      params.customerId = req.query.customerId || req.query.customer_id;
    }
    const response = await http.get(`${BASE_URL}/orders/${req.params.orderId}`, {
      headers: buildHeaders(req),
      params,
    });
    res.json(response.data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to fetch delivery' });
  }
});

router.get('/orders/:orderId/logs', ensureCustomerIdentity, async (req, res) => {
  try {
    const params = { limit: req.query.limit };
    if (req.customerIdentity?.userId) {
      params.customerId = req.customerIdentity.userId;
    } else if (req.query?.customerId || req.query?.customer_id) {
      params.customerId = req.query.customerId || req.query.customer_id;
    }
    const response = await http.get(`${BASE_URL}/orders/${req.params.orderId}/logs`, {
      headers: buildHeaders(req),
      params,
    });
    res.json(response.data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to fetch delivery logs' });
  }
});

module.exports = router;
