// user-service/routes/restaurant.routes.js

const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurant.controller');

router.get('/status', restaurantController.getStatus);
router.get('/owners/:id', restaurantController.getOwnerAccount);
router.post('/register', restaurantController.register); // { first_name,last_name,email,phone,password }
router.post('/verify', restaurantController.verify);     // { email, otp }
router.post('/login', restaurantController.login);       // { email, password }

module.exports = router;
