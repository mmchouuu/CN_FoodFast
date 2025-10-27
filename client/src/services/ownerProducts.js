import api from './api';

const adaptBranchAssignment = (assignment = {}) => ({
  ...assignment,
  branch_id: assignment.branch_id || assignment.branchId || assignment.branch,
  product_id: assignment.product_id || assignment.productId,
});

const adaptProduct = (product = {}) => {
  const basePrice =
    typeof product.base_price === 'number'
      ? product.base_price
      : typeof product.basePrice === 'number'
      ? product.basePrice
      : Number(product.base_price || product.basePrice || 0);

  return {
    id: product.id,
    restaurant_id: product.restaurant_id || product.restaurantId,
    title: product.title || '',
    description: product.description || '',
    images: Array.isArray(product.images) ? product.images : [],
    type: product.type || '',
    category: product.category || product.category_name || '',
    category_id: product.category_id || product.categoryId || null,
    base_price: basePrice,
    popular: Boolean(product.popular),
    is_active:
      product.is_active !== undefined
        ? product.is_active
        : product.available !== false && product.is_visible !== false,
    available: product.available !== false,
    is_visible: product.is_visible !== false,
    branch_assignments: Array.isArray(product.branch_assignments)
      ? product.branch_assignments.map(adaptBranchAssignment)
      : [],
    created_at: product.created_at || product.createdAt || null,
    updated_at: product.updated_at || product.updatedAt || null,
  };
};

const adaptInventoryList = (items = []) =>
  (Array.isArray(items) ? items : []).map(adaptBranchAssignment);

const ownerProductService = {
  async listCategories(restaurantId) {
    const { data } = await api.get(`/api/restaurants/${restaurantId}/categories`);
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data)) return data;
    return [];
  },

  async createCategory(restaurantId, payload) {
    const { data } = await api.post(`/api/restaurants/${restaurantId}/categories`, payload);
    return data;
  },

  async listByRestaurant(restaurantId, params = {}) {
    const query = { limit: 200, ...params };
    const { data } = await api.get(`/api/restaurants/${restaurantId}/products`, {
      params: query,
    });
    const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : data?.data;
    if (!Array.isArray(list)) return [];
    return list.map(adaptProduct);
  },

  async create(restaurantId, payload) {
    const response = await api.post(`/api/restaurants/${restaurantId}/products`, payload);
    return adaptProduct(response?.data);
  },

  async update(restaurantId, productId, payload) {
    const response = await api.patch(
      `/api/restaurants/${restaurantId}/products/${productId}`,
      payload,
    );
    return adaptProduct(response?.data);
  },

  async remove(restaurantId, productId) {
    await api.delete(`/api/restaurants/${restaurantId}/products/${productId}`);
    return true;
  },

  async fetchInventory(restaurantId, productId) {
    const { data } = await api.get(
      `/api/restaurants/${restaurantId}/products/${productId}/inventory`,
    );
    return adaptInventoryList(data);
  },

  async updateInventory(restaurantId, branchId, productId, payload) {
    const response = await api.put(
      `/api/restaurants/${restaurantId}/branches/${branchId}/inventory/${productId}`,
      payload,
    );
    return adaptBranchAssignment(response?.data || {});
  },

  async createOptionGroup(restaurantId, productId, payload) {
    const { data } = await api.post(
      `/api/restaurants/${restaurantId}/products/${productId}/options`,
      payload,
    );
    return data;
  },

  async createCombo(restaurantId, payload) {
    const { data } = await api.post(`/api/restaurants/${restaurantId}/combos`, payload);
    return data;
  },
};

export default ownerProductService;
