// api-gateway/src/routes/restaurants.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/restaurants.controller');

router.get('/status', controller.status);
router.get('/owners/:id', controller.ownerAccount);
router.post('/register', controller.register);
router.post('/verify', controller.verify);
router.post('/login', controller.login);

module.exports = router;
