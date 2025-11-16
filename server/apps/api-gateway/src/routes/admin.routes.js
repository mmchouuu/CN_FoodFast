const express = require('express');
const controller = require('../controllers/admins.controller');

const router = express.Router();

router.post('/login', controller.login);
router.get('/customers', controller.listCustomers);
router.get('/customers/:id', controller.customerDetails);
router.patch('/customers/:id/status', controller.updateCustomerStatus);

router.get('/owners', controller.listOwners);
router.post('/owners/:id/approve', controller.approveOwner);
router.post('/owners/:id/reject', controller.rejectOwner);

router.post('/catalog/taxes/templates', controller.createTaxTemplate);
router.post('/catalog/taxes/assignments', controller.assignTax);
router.post('/catalog/calendars', controller.createCalendar);
router.post('/catalog/promotions/global', controller.createGlobalPromotion);
router.get('/payouts', controller.listPayoutRestaurants);
router.get('/payouts/restaurants/:restaurantId/branches', controller.listPayoutBranches);
router.get('/payouts/settlements/:settlementId/orders', controller.listPayoutSettlementOrders);

module.exports = router;
