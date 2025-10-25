const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const paymentMethodController = require('../controllers/paymentMethod.controller');

router.get('/payment-methods/bank-accounts', paymentMethodController.listBankAccounts);
router.post('/payment-methods/bank-accounts', paymentMethodController.createBankAccount);

router.post('/', paymentController.create);
router.get('/:id', paymentController.get);

module.exports = router;
