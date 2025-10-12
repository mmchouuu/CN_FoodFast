import express from 'express';
import {
  getRestaurants,
  getRestaurant,
  addRestaurant,
  editRestaurant,
  removeRestaurant
} from '../controllers/restaurant.controller.js';

const router = express.Router();

router.get('/', getRestaurants);
router.get('/:id', getRestaurant);
router.post('/', addRestaurant);
router.put('/:id', editRestaurant);
router.delete('/:id', removeRestaurant);

export default router;
