import express from 'express';
import {
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
} from '../controllers/restaurant.controller.js';

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

export default router;
