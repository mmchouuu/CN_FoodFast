const express = require('express');
const axios = require('axios');
const attachOwnerContext = require('../middlewares/ownerContext');

const router = express.Router();

const DELIVERY_SERVICE_URL = process.env.DELIVERY_SERVICE_URL || 'http://delivery-service:3006';
const BASE_PATH = '/api/deliveries';

const buildHeaders = (req) => {
  const headers = {};
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  if (req.ownerContext?.ownerId) {
    headers['x-owner-id'] = req.ownerContext.ownerId;
  }
  if (req.ownerContext?.branchIds?.length) {
    headers['x-branch-ids'] = req.ownerContext.branchIds.join(',');
  }
  return headers;
};

const forward = async (method, path, req, body) => {
  const url = `${DELIVERY_SERVICE_URL}${BASE_PATH}${path}`;
  const headers = buildHeaders(req);
  const config = { method, url, headers };
  if (method === 'get' || method === 'delete') {
    config.params = req.query;
  } else {
    config.data = body;
  }
  const response = await axios(config);
  return response.data;
};

router.get('/summary', attachOwnerContext, async (req, res) => {
  try {
    const data = await forward('get', '/drones/summary', req);
    res.json(data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to fetch drone summary' });
  }
});

router.get('/', attachOwnerContext, async (req, res) => {
  try {
    const data = await forward('get', '/drones', req);
    res.json(data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to fetch drones' });
  }
});

router.post('/', attachOwnerContext, async (req, res) => {
  try {
    const data = await forward('post', '/drones', req, req.body);
    res.status(201).json(data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to create drone' });
  }
});

router.put('/:id', attachOwnerContext, async (req, res) => {
  try {
    const data = await forward('put', `/drones/${req.params.id}`, req, req.body);
    res.json(data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to update drone' });
  }
});

router.delete('/:id', attachOwnerContext, async (req, res) => {
  try {
    const data = await forward('delete', `/drones/${req.params.id}`, req);
    res.json(data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to delete drone' });
  }
});

router.get('/:id/logs', attachOwnerContext, async (req, res) => {
  try {
    const data = await forward('get', `/drones/${req.params.id}/logs`, req);
    res.json(data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json(error?.response?.data || { error: 'Failed to fetch drone logs' });
  }
});

module.exports = router;
