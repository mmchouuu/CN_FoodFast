// api-gateway/src/routes/users.routes.jsx

const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');

router.post('/register', usersController.register);
router.post('/login', usersController.login);
router.post('/verify', usersController.verify);
router.get('/', usersController.getAll);
router.get('/health', usersController.health);

module.exports = router;
