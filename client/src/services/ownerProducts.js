import api from './api';

const catalogRequestCache = new Map();

function buildParamsKey(params = {}) {
  const entries = Object.entries(params || {})
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  return JSON.stringify(entries);
}

async function fetchRestaurantCatalog(restaurantId, params = {}) {
  if (!restaurantId) return null;
  const cacheKey = `${restaurantId}:${buildParamsKey(params)}`;
  if (catalogRequestCache.has(cacheKey)) {
    return catalogRequestCache.get(cacheKey);
  }

  const request = api
    .get(`/api/restaurants/${restaurantId}/catalog`, { params })
    .then((response) => response.data)
    .catch((error) => {
      catalogRequestCache.delete(cacheKey);
      throw error;
    });

  catalogRequestCache.set(cacheKey, request);
  return request;
}

const adaptBranchAssignment = (assignment = {}) => {
  if (!assignment) return null;
  const branchId =
    assignment.branch_id ||
    assignment.branchId ||
    assignment.branch;
  const productId = assignment.product_id || assignment.productId || null;
  const priceMode = assignment.price_mode || assignment.priceMode || 'inherit';
  const basePriceOverride =
    assignment.base_price_override !== undefined && assignment.base_price_override !== null
      ? Number(assignment.base_price_override)
      : assignment.basePriceOverride !== undefined && assignment.basePriceOverride !== null
        ? Number(assignment.basePriceOverride)
        : null;
  const priceWithTax =
    assignment.price_with_tax !== undefined && assignment.price_with_tax !== null
      ? Number(assignment.price_with_tax)
      : assignment.priceWithTax !== undefined && assignment.priceWithTax !== null
        ? Number(assignment.priceWithTax)
        : null;
  const taxRate =
    assignment.tax_rate !== undefined && assignment.tax_rate !== null
      ? Number(assignment.tax_rate)
      : assignment.taxRate !== undefined && assignment.taxRate !== null
        ? Number(assignment.taxRate)
        : null;

  return {
    ...assignment,
    branch_id: branchId,
    product_id: productId,
    price_mode: priceMode,
    base_price_override: basePriceOverride,
    price_with_tax: priceWithTax,
    tax_rate: taxRate,
    quantity:
      assignment.quantity === undefined || assignment.quantity === null
        ? null
        : Number(assignment.quantity),
    reserved_qty:
      assignment.reserved_qty === undefined || assignment.reserved_qty === null
        ? null
        : Number(assignment.reserved_qty),
    min_stock:
      assignment.min_stock === undefined || assignment.min_stock === null
        ? null
        : Number(assignment.min_stock),
    daily_limit:
      assignment.daily_limit === undefined || assignment.daily_limit === null
        ? null
        : Number(assignment.daily_limit),
  };
};

const adaptProduct = (product = {}) => {
  const basePrice =
    typeof product.base_price === 'number'
      ? product.base_price
      : typeof product.basePrice === 'number'
        ? product.basePrice
        : Number(product.base_price || product.basePrice || 0);

  const priceWithTaxRaw =
    product.price_with_tax !== undefined && product.price_with_tax !== null
      ? product.price_with_tax
      : product.priceWithTax;
  const priceWithTax =
    priceWithTaxRaw === undefined || priceWithTaxRaw === null
      ? basePrice
      : Number(priceWithTaxRaw);

  const branchAssignments = Array.isArray(product.branch_assignments)
    ? product.branch_assignments.map(adaptBranchAssignment).filter(Boolean)
    : [];

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
    price_with_tax: priceWithTax,
    tax_rate:
      product.tax_rate === undefined || product.tax_rate === null
        ? product.taxRate || null
        : Number(product.tax_rate),
    options: Array.isArray(product.options) ? product.options : [],
    popular: Boolean(product.popular),
    is_active:
      product.is_active !== undefined
        ? product.is_active
        : product.available !== false && product.is_visible !== false,
    available: product.available !== false,
    is_visible: product.is_visible !== false,
    branch_assignments: branchAssignments,
    created_at: product.created_at || product.createdAt || null,
    updated_at: product.updated_at || product.updatedAt || null,
  };
};

const adaptInventoryList = (items = []) =>
  (Array.isArray(items) ? items : []).map(adaptBranchAssignment).filter(Boolean);

const adaptCategory = (input) => {
  if (!input) return null;
  if (typeof input === 'string') {
    const name = input.trim();
    if (!name) return null;
    return {
      id: null,
      name,
      description: null,
      productCount: 0,
      branch_assignments: [],
    };
  }
  if (typeof input !== 'object') return null;
  const rawAssignments = input.branch_assignments || input.branchAssignments || [];
  const branchAssignments = Array.isArray(rawAssignments)
    ? rawAssignments
        .map((assignment) => {
          if (!assignment) return null;
          const branchId =
            assignment.branch_id ||
            assignment.branchId ||
            assignment.branch;
          if (!branchId) return null;
          return {
            branch_id: branchId,
            is_visible: assignment.is_visible !== false,
            is_active: assignment.is_active !== false,
            display_order: assignment.display_order ?? assignment.displayOrder ?? null,
          };
        })
        .filter(Boolean)
    : [];
  const name = (input.name || input.label || '').trim();
  if (!name) return null;
  return {
    id: input.id || input.category_id || null,
    name,
    description: input.description || null,
    productCount: Number(input.productCount ?? input.product_count ?? 0),
    branch_assignments: branchAssignments,
  };
};

const adaptComboGroupItem = (item = {}) => ({
  id: item.id,
  item_type: item.item_type || item.itemType || 'product',
  product_id: item.product_id || item.productId || null,
  category_id: item.category_id || item.categoryId || null,
  extra_price:
    typeof item.extra_price === 'number'
      ? item.extra_price
      : typeof item.extraPrice === 'number'
        ? item.extraPrice
        : Number(item.extra_price || item.extraPrice || 0),
});

const adaptComboGroup = (group = {}) => ({
  id: group.id,
  name: group.name || '',
  min_select: Number(group.min_select ?? group.minSelect ?? 1),
  max_select:
    group.max_select !== undefined && group.max_select !== null
      ? Number(group.max_select)
      : group.maxSelect !== undefined && group.maxSelect !== null
        ? Number(group.maxSelect)
        : null,
  required: group.required !== false,
  display_order: group.display_order ?? group.displayOrder ?? null,
  items: Array.isArray(group.items) ? group.items.map(adaptComboGroupItem) : [],
});

const adaptCombo = (combo = {}) => ({
  id: combo.id,
  restaurant_id: combo.restaurant_id || combo.restaurantId,
  name: combo.name || '',
  description: combo.description || '',
  base_price:
    typeof combo.base_price === 'number'
      ? combo.base_price
      : typeof combo.basePrice === 'number'
        ? combo.basePrice
        : Number(combo.base_price || combo.basePrice || 0),
  images: Array.isArray(combo.images) ? combo.images : [],
  is_active: combo.is_active !== false,
  available_from: combo.available_from || combo.availableFrom || null,
  available_until: combo.available_until || combo.availableUntil || null,
  groups: Array.isArray(combo.groups) ? combo.groups.map(adaptComboGroup) : [],
  branch_assignments: Array.isArray(combo.branch_assignments)
    ? combo.branch_assignments.map((assignment) => ({
        ...assignment,
        branch_id: assignment.branch_id || assignment.branchId || null,
        combo_id: assignment.combo_id || assignment.comboId || combo.id,
        is_available: assignment.is_available !== false,
        is_visible: assignment.is_visible !== false,
        base_price_override:
          assignment.base_price_override === null || assignment.base_price_override === undefined
            ? null
            : Number(assignment.base_price_override),
        price_with_tax:
          assignment.price_with_tax === null || assignment.price_with_tax === undefined
            ? null
            : Number(assignment.price_with_tax),
      }))
    : [],
});

const adaptBranchMenus = (branches = []) =>
  Array.isArray(branches)
    ? branches.map((branch) => ({
        ...branch,
        products: Array.isArray(branch.products) ? branch.products : [],
        combos: Array.isArray(branch.combos) ? branch.combos : [],
      }))
    : [];

const ownerProductService = {
  async listCategories(restaurantId, params = {}) {
    if (!restaurantId) return [];
    const catalog = await fetchRestaurantCatalog(restaurantId, params);
    const list = Array.isArray(catalog?.categories) ? catalog.categories : [];
    return list.map(adaptCategory).filter((item) => item && item.name);
  },

  async createCategory(restaurantId, payload) {
    const { data } = await api.post(`/api/restaurants/${restaurantId}/categories`, payload);
    return adaptCategory(data) || data;
  },

  async listByRestaurant(restaurantId, params = {}) {
    if (!restaurantId) return [];
    const query = { limit: 200, ...params };
    const catalog = await fetchRestaurantCatalog(restaurantId, query);
    const productList = Array.isArray(catalog?.products) ? catalog.products : [];
    const adapted = productList.map(adaptProduct);
    const combos = Array.isArray(catalog?.combos) ? catalog.combos.map(adaptCombo) : [];
    adapted.combos = combos;
    adapted.branches = adaptBranchMenus(catalog?.branches || []);
    adapted.categories = Array.isArray(catalog?.categories)
      ? catalog.categories.map(adaptCategory).filter(Boolean)
      : [];
    adapted.catalog = catalog;
    return adapted;
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
