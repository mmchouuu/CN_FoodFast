// user-service/src/routes/user.routes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');


router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/verify', userController.verify);  
router.get('/', userController.getAll);

module.exports = router;
