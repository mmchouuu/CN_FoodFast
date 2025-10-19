// api-gateway/src/routes/customers.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/customers.controller');

router.post('/register', controller.register);
router.post('/verify', controller.verify);
router.post('/login', controller.login);
router.post('/forgot-password', controller.requestPasswordReset);
router.post('/reset-password', controller.resetPassword);

module.exports = router;
