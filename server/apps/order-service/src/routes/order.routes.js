const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/order.controller');

router.post('/', ctrl.create);
router.get('/:id', ctrl.get);

module.exports = router;
