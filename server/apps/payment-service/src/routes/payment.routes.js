const express = require('express');
const paymentController = require('../controllers/payment.controller');
const paymentMethodController = require('../controllers/paymentMethod.controller');

const router = express.Router();

router.get('/payment-methods/bank-accounts', paymentMethodController.listBankAccounts);
router.post('/payment-methods/bank-accounts', paymentMethodController.createBankAccount);

router.get('/', paymentController.listPayments);
router.post('/', paymentController.createPayment);
router.get('/:id', paymentController.getPaymentById);

module.exports = router;
