const express = require('express');
const customerController = require('../controllers/orders.customer.controller');

const router = express.Router();

router.post('/', customerController.createOrder);
router.get('/', customerController.listOrders);
router.get('/cart', customerController.getSavedCart);
router.put('/cart', customerController.saveCartSnapshot);
router.delete('/cart', customerController.clearCartSnapshot);
router.get('/:id', customerController.getOrder);
router.post('/:id/cancel', customerController.cancelOrder);
router.post('/:id/complete', customerController.confirmOrder);

module.exports = router;
