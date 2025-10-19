const express = require('express');
const {
  addBranch,
  addRestaurant,
  editRestaurant,
  getOwnerRestaurantDetail,
  getOwnerRestaurants,
  getRestaurant,
  getRestaurants,
  listBranches,
  removeRestaurant,
  editBranch,
  removeBranch,
} = require('../controllers/restaurant.controller');

const router = express.Router();

router.get('/', getRestaurants);
router.get('/owner/:ownerId/list', getOwnerRestaurants);
router.get('/owner/:ownerId', getOwnerRestaurantDetail);
router.get('/:id', getRestaurant);
router.get('/:id/branches', listBranches);
router.post('/', addRestaurant);
router.post('/:id/branches', addBranch);
router.put('/:id/branches/:branchId', editBranch);
router.delete('/:id/branches/:branchId', removeBranch);
router.put('/:id', editRestaurant);
router.delete('/:id', removeRestaurant);

// const ctrl = require('../controllers/restaurant.controller');

// router.get('/', ctrl.list);
// router.post('/', ctrl.create);
// router.get('/:id', ctrl.get);
// router.patch('/:id', ctrl.update);
// router.delete('/:id', ctrl.remove);

module.exports = router;