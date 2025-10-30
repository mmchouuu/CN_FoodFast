const express = require('express');
const controller = require('../controllers/restaurants.controller');

const router = express.Router();

// Owner account flows (user-service)
router.post('/signup', controller.ownerSignup);
router.post('/verify', controller.ownerVerify);
router.post('/login', controller.ownerLogin);
router.get('/status', controller.ownerStatus);
router.post('/resend-verification', controller.resendVerification);

// Catalog & branch management (product-service)
router.post('/', controller.createRestaurant);
router.get('/catalog', controller.listCatalog);
router.get('/owner/:ownerId', controller.getRestaurantByOwner);
router.get('/owner/:ownerId/list', controller.listRestaurantsByOwner);
router.get('/:restaurantId/catalog', controller.getCatalog);
router.get('/:restaurantId', controller.getRestaurant);
router.put('/:restaurantId', controller.updateRestaurant);
router.post('/:restaurantId/branches', controller.createBranch);
router.get('/:restaurantId/branches', controller.listBranches);
router.put('/:restaurantId/branches/:branchId', controller.updateBranch);
router.put('/:restaurantId/branches/:branchId/schedules', controller.updateBranchSchedules);
router.delete('/:restaurantId/branches/:branchId', controller.deleteBranch);
router.post('/:restaurantId/members', controller.inviteMember);

router.post('/:restaurantId/categories', controller.createCategory);
router.get('/:restaurantId/categories', controller.listCategories);
router.post('/:restaurantId/products', controller.createProduct);
router.get('/:restaurantId/products', controller.listProducts);
router.patch('/:restaurantId/products/:productId', controller.updateProduct);
router.delete('/:restaurantId/products/:productId', controller.deleteProduct);
router.get('/:restaurantId/products/:productId/inventory', controller.listInventory);
router.put('/:restaurantId/branches/:branchId/inventory/:productId', controller.updateInventory);
router.post('/:restaurantId/products/:productId/options', controller.createOptionGroup);
router.post('/:restaurantId/combos', controller.createCombo);
router.post('/:restaurantId/promotions', controller.createPromotion);

module.exports = router;
