import api from './api';

export function fetchRestaurantReviews(restaurantId, params = {}) {
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }
  return api
    .get(`/api/restaurants/${restaurantId}/reviews`, { params })
    .then((response) => response.data);
}

export function submitRestaurantReview(restaurantId, payload = {}) {
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }
  return api
    .post(`/api/restaurants/${restaurantId}/reviews`, payload)
    .then((response) => response.data);
}

export function fetchProductReviews(restaurantId, productId, params = {}) {
  if (!restaurantId || !productId) {
    throw new Error('restaurantId and productId are required');
  }
  return api
    .get(`/api/restaurants/${restaurantId}/products/${productId}/reviews`, { params })
    .then((response) => response.data);
}

export function fetchOwnerRestaurantReviews(restaurantId, params = {}) {
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }
  return api
    .get(`/owner/restaurants/${restaurantId}/reviews`, { params })
    .then((response) => response.data);
}

export function replyRestaurantReview(restaurantId, reviewId, payload = {}) {
  if (!restaurantId || !reviewId) {
    throw new Error('restaurantId and reviewId are required');
  }
  return api
    .post(`/owner/restaurants/${restaurantId}/reviews/${reviewId}/reply`, payload)
    .then((response) => response.data);
}

const reviewsService = {
  fetchRestaurantReviews,
  submitRestaurantReview,
  fetchProductReviews,
  fetchOwnerRestaurantReviews,
  replyRestaurantReview,
};

export default reviewsService;
