export const buildRestaurantLink = (order) => {
  if (!order) {
    return '/restaurants';
  }

  const restaurantId = order.restaurantId || order.restaurant_id;
  if (!restaurantId) {
    return '/restaurants';
  }

  const branchId = order.branchId || order.branch_id;
  return branchId
    ? `/restaurants/${restaurantId}?branch=${branchId}`
    : `/restaurants/${restaurantId}`;
};
