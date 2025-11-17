const express = require('express');
const internalController = require('../controllers/internal.controller');

const router = express.Router();

router.post('/orders/inventory', internalController.decrementInventory);

module.exports = router;
