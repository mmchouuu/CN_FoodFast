// payment-service/src/routes/payment.route.js

const express = require('express');
const paymentController = require('../controllers/payment.controller');
const paymentMethodController = require('../controllers/paymentMethod.controller');
const paymentsCustomerController = require('../controllers/payments.customer.controller');
const paymentIntentController = require('../controllers/paymentIntent.controller');
const refundController = require('../controllers/refund.controller');

const router = express.Router();

router.get('/payment-methods', paymentMethodController.listPaymentMethods);
router.post('/payment-methods', paymentMethodController.createPaymentMethod);
router.get('/payment-methods/wallets', paymentMethodController.listWallets);
router.post('/payment-methods/wallets', paymentMethodController.createWallet);
router.get('/payment-methods/bank-accounts', paymentMethodController.listBankAccounts);
router.post('/payment-methods/bank-accounts', paymentMethodController.createBankAccount);

router.post('/stripe/setup-intent', paymentsCustomerController.createStripeSetupIntent);
router.post('/stripe/confirm', paymentsCustomerController.confirmStripePaymentMethod);
router.get('/stripe/payment-methods', paymentsCustomerController.listPaymentMethods);

router.post('/intents', paymentIntentController.createIntent);
router.post('/confirm', paymentIntentController.confirmPayment);

router.post('/refunds', refundController.createRefund);
router.get('/', paymentController.listPayments);
router.post('/', paymentController.createPayment);
router.get('/:id', paymentController.getPaymentById);

module.exports = router;
