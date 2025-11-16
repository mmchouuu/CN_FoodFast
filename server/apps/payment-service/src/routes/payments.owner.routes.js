const express = require('express');
const controller = require('../controllers/payments.owner.controller');

const router = express.Router();

router.get('/', controller.listSettlements);
router.get('/:settlementId/orders', controller.listSettlementOrders);

module.exports = router;
