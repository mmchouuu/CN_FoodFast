const express = require('express');
const attachOwnerContext = require('../middlewares/ownerContext');
const controller = require('../controllers/restaurants.controller');

const router = express.Router();

router.use(attachOwnerContext);

router.get('/:restaurantId/reviews', controller.listRestaurantReviewsOwner);
router.post(
  '/:restaurantId/reviews/:reviewId/reply',
  controller.replyRestaurantReviewOwner,
);

module.exports = router;
