<<<<<<< HEAD
// user-service/src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-service' }));
router.post('/register', userController.register);
router.post('/verify', userController.verify);
router.post('/login', userController.login);
router.get('/', userController.getAll);

module.exports = router;
=======
// user-service/src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-service' }));
router.post('/register', userController.register);
router.post('/verify', userController.verify);
router.post('/login', userController.login);
router.get('/', userController.getAll);

module.exports = router;
>>>>>>> e1903a6c2a79f913b83ae286c7238cad8b947f1d
