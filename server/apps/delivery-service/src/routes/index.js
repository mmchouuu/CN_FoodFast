const { Router } = require('express');
const deliveryController = require('../controllers/delivery.controller');

const router = Router();

router.get('/', deliveryController.listDeliveries);
router.get('/status', deliveryController.getStatus);

module.exports = router;
