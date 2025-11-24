const express = require('express');
const cartController = require('../controllers/cart.customer.controller');

const router = express.Router();

router.get('/', cartController.getCart);
router.post('/', cartController.replaceCart);
router.put('/', cartController.replaceCart);
router.delete('/', cartController.clearCart);

module.exports = router;
