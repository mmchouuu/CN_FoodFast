const express = require('express');
const controller = require('../controllers/payments.admin.controller');

const router = express.Router();

router.get('/payments', controller.listPayments);
router.get('/refunds', controller.listRefunds);
router.get('/payouts/restaurants', controller.listPayoutRestaurants);
router.get('/payouts/restaurants/:restaurantId/branches', controller.listPayoutBranches);
router.get('/payouts/settlements/:settlementId/orders', controller.listSettlementOrders);

module.exports = router;

