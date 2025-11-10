const express = require('express');
const paymentsInternalController = require('../controllers/payments.internal.controller');

const router = express.Router();

router.post('/lookup', paymentsInternalController.lookupPayments);

module.exports = router;
