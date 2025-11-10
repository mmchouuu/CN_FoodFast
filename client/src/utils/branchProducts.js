export const matchesBranchProduct = (dish, branchId) => {
  if (!dish || !branchId) return false;
  const branchKey = String(branchId);
  if (dish.branchId && String(dish.branchId) === branchKey) {
    return true;
  }
  if (dish.branch_id && String(dish.branch_id) === branchKey) {
    return true;
  }
  const assignments = Array.isArray(dish.branchAssignments) && dish.branchAssignments.length
    ? dish.branchAssignments
    : Array.isArray(dish.branch_assignments)
      ? dish.branch_assignments
      : [];
  return assignments.some((assignment) => {
    if (!assignment) return false;
    const assignmentBranchId = assignment.branch_id || assignment.branchId || assignment.branch;
    return assignmentBranchId && String(assignmentBranchId) === branchKey;
  });
};

export const resolveBranchDishes = ({
  branch,
  getDishesByRestaurant,
  fallbackRestaurantId = null,
} = {}) => {
  if (!branch) return [];
  const localProducts = Array.isArray(branch.products) ? branch.products : [];
  if (localProducts.length) {
    return localProducts;
  }

  if (typeof getDishesByRestaurant !== 'function') {
    return [];
  }

  const restaurantId =
    fallbackRestaurantId ||
    branch.restaurantId ||
    branch.brandRestaurantId ||
    branch.brand?.id ||
    null;

  if (!restaurantId) {
    return [];
  }

  const fallback = getDishesByRestaurant(restaurantId) || [];
  if (!branch.id || !fallback.length) {
    return fallback;
  }

  const scoped = fallback.filter((dish) => matchesBranchProduct(dish, branch.id));
  return scoped.length ? scoped : fallback;
};

export default {
  matchesBranchProduct,
  resolveBranchDishes,
};
