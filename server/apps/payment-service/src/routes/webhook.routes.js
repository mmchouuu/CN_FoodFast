// payment-service/src/routes/webhook.route.js

const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/stripe', webhookController.handleStripeWebhook);
router.post('/momo', webhookController.handleMomoWebhook);

module.exports = router;
