const express = require('express');
const authenticate = require('../middleware/auth');
const controller = require('../controllers/orders.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.listOrders);
router.get('/:orderId', controller.getOrderById);
router.post('/', controller.createOrder);

module.exports = router;
