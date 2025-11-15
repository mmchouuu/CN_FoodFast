const express = require('express');
const paymentsInternalController = require('../controllers/payments.internal.controller');

const router = express.Router();

router.post('/lookup', paymentsInternalController.lookupPayments);
router.post('/confirm-cash', paymentsInternalController.confirmCashPayment);

module.exports = router;
