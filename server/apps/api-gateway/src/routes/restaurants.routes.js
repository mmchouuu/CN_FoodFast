// api-gateway/src/routes/restaurants.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/restaurants.controller');

router.get('/status', controller.status);
router.get('/owners/:id', controller.ownerAccount);
router.post('/register', controller.register);
router.post('/verify', controller.verify);
router.post('/login', controller.login);
router.get('/', controller.listRestaurants);
router.get('/owner/:ownerId/list', controller.getOwnerRestaurants);
router.get('/owner/:ownerId', controller.getOwnerRestaurantDetail);
router.get('/:id/branches', controller.listBranches);
router.post('/:id/branches', controller.createBranch);
router.put('/:id/branches/:branchId', controller.updateBranch);
router.delete('/:id/branches/:branchId', controller.deleteBranch);
router.get('/:id/products', controller.listRestaurantProducts);
router.post('/:id/products', controller.createRestaurantProduct);
router.patch('/:id/products/:productId', controller.updateRestaurantProduct);
router.delete('/:id/products/:productId', controller.deleteRestaurantProduct);
router.get('/:id/inventory', controller.listRestaurantInventory);
router.get('/:id/products/:productId/inventory', controller.listProductInventory);
router.get('/:id/branches/:branchId/inventory', controller.listBranchInventory);
router.put('/:id/branches/:branchId/inventory/:productId', controller.upsertBranchInventory);
router.get('/:id/categories', controller.listCategories);
router.post('/', controller.createRestaurant);
router.put('/:id', controller.updateRestaurant);
router.delete('/:id', controller.deleteRestaurant);
router.get('/:id', controller.getRestaurant);

module.exports = router;
