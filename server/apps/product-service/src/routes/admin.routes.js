const express = require('express');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.post('/taxes', adminController.createTaxTemplate);
router.post('/taxes/assignments', adminController.assignTax);
router.post('/calendars', adminController.createCalendar);
router.post('/promotions/global', adminController.createGlobalPromotion);

module.exports = router;
