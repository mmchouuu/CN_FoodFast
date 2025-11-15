const express = require('express');
const OrderController = require('../controllers/order.controller');

const router = express.Router();

router.get('/', OrderController.getAllOrders);
router.get('/user/:userId', OrderController.getOrdersByUser);
router.get('/:id', OrderController.getOrderById);
router.post('/', OrderController.createOrder);
router.put('/:id/status', OrderController.updateOrderStatus);
router.post('/:id/complete', OrderController.confirmOrder);
router.delete('/:id', OrderController.deleteOrder);

module.exports = router;
