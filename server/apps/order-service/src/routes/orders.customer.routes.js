const express = require('express');
const customerController = require('../controllers/orders.customer.controller');

const router = express.Router();

router.post('/', customerController.createOrder);
router.get('/', customerController.listOrders);
router.get('/:id', customerController.getOrder);
router.post('/:id/cancel', customerController.cancelOrder);

module.exports = router;
