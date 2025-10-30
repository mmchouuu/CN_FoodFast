const express = require('express');
const restaurantController = require('../controllers/restaurant.controller');
const menuController = require('../controllers/menu.controller');
const catalogController = require('../controllers/catalog.controller');

const router = express.Router();

router.post('/', restaurantController.createRestaurant);
router.get('/catalog', catalogController.listCatalog);
router.get('/owner/:ownerId', restaurantController.getByOwner);
router.get('/owner/:ownerId/list', restaurantController.listByOwner);
router.get('/:restaurantId/catalog', catalogController.getCatalog);
router.get('/:restaurantId', restaurantController.getRestaurant);
router.put('/:restaurantId', restaurantController.updateRestaurant);
router.post('/:restaurantId/branches', restaurantController.createBranch);
router.get('/:restaurantId/branches', restaurantController.listBranches);
router.put('/:restaurantId/branches/:branchId', restaurantController.updateBranch);
router.put('/:restaurantId/branches/:branchId/schedules', restaurantController.updateBranchSchedules);
router.delete('/:restaurantId/branches/:branchId', restaurantController.deleteBranch);
router.post('/:restaurantId/members', restaurantController.inviteMember);

router.post('/:restaurantId/categories', menuController.createCategory);
router.get('/:restaurantId/categories', menuController.listCategories);
router.post('/:restaurantId/products', menuController.createProduct);
router.get('/:restaurantId/products', menuController.listProducts);
router.patch('/:restaurantId/products/:productId', menuController.updateProduct);
router.delete('/:restaurantId/products/:productId', menuController.deleteProduct);
router.get('/:restaurantId/products/:productId/inventory', menuController.listInventory);
router.put('/:restaurantId/branches/:branchId/inventory/:productId', menuController.updateInventory);
router.post('/:restaurantId/products/:productId/options', menuController.createOptionGroup);
router.post('/:restaurantId/combos', menuController.createCombo);
router.post('/:restaurantId/promotions', menuController.createPromotion);

module.exports = router;
