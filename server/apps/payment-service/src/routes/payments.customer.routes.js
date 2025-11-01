const express = require('express');
const controller = require('../controllers/payments.customer.controller');

const router = express.Router();

router.post('/stripe/setup-intent', controller.createStripeSetupIntent);
router.post('/stripe/confirm', controller.confirmStripePaymentMethod);
router.get('/', controller.listPaymentMethods);

module.exports = router;
