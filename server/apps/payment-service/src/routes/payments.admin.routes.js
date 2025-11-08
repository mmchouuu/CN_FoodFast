const express = require('express');
const controller = require('../controllers/payments.admin.controller');

const router = express.Router();

router.get('/payments', controller.listPayments);
router.get('/refunds', controller.listRefunds);

module.exports = router;
