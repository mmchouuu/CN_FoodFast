<<<<<<< HEAD
﻿const express = require('express');
const restaurantController = require('../controllers/restaurant.controller');

const router = express.Router();

router.post('/signup', restaurantController.register);
router.post('/verify', restaurantController.verify);
router.post('/password', restaurantController.setPassword);
router.post('/login', restaurantController.login);
router.get('/status', restaurantController.status);
router.post('/:restaurantId/accounts/owner-main', restaurantController.createOwnerMainAccount);
router.post('/:restaurantId/accounts/members', restaurantController.createMember);
router.post('/resend-verification', restaurantController.resendVerification);

module.exports = router;
=======
﻿const express = require('express');
const restaurantController = require('../controllers/restaurant.controller');

const router = express.Router();

router.post('/signup', restaurantController.register);
router.post('/verify', restaurantController.verify);
router.post('/password', restaurantController.setPassword);
router.post('/login', restaurantController.login);
router.get('/status', restaurantController.status);
router.post('/:restaurantId/accounts/owner-main', restaurantController.createOwnerMainAccount);
router.post('/:restaurantId/accounts/members', restaurantController.createMember);
router.post('/resend-verification', restaurantController.resendVerification);

module.exports = router;
>>>>>>> e1903a6c2a79f913b83ae286c7238cad8b947f1d
