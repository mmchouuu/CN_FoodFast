// api-gateway/src/routes/restaurants.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/restaurants.controller');

router.get('/status', controller.status);
router.get('/owners/:id', controller.ownerAccount);
router.post('/register', controller.register);
router.post('/verify', controller.verify);
router.post('/login', controller.login);
router.get('/owner/:ownerId/list', controller.getOwnerRestaurants);
router.get('/owner/:ownerId', controller.getOwnerRestaurantDetail);
router.get('/:id/branches', controller.listBranches);
router.post('/:id/branches', controller.createBranch);
router.put('/:id/branches/:branchId', controller.updateBranch);
router.delete('/:id/branches/:branchId', controller.deleteBranch);
router.post('/', controller.createRestaurant);
router.put('/:id', controller.updateRestaurant);
router.delete('/:id', controller.deleteRestaurant);
router.get('/:id', controller.getRestaurant);

module.exports = router;
