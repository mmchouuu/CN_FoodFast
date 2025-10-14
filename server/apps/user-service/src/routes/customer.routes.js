// user-service/routes/customer.routes.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

router.post('/register', customerController.register);   // { first_name,last_name,email,phone,password }
router.post('/verify', customerController.verify);       // { email, otp }
router.post('/login', customerController.login);         // { email, password }

module.exports = router;
