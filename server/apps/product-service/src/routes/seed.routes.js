const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/seed.controller');

router.post('/sample', ctrl.seedSample);

module.exports = router;
