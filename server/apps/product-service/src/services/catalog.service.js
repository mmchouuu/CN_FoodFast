const restaurantRepository = require('../repositories/restaurant.repository');
const optionsRepository = require('../repositories/options.repository');
const comboRepository = require('../repositories/combo.repository');
const taxRepository = require('../repositories/tax.repository');
const menuService = require('./menu.service');

const DEFAULT_TAX_RATE = 7;

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normaliseUuid(value) {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function computePriceWithTax(basePrice, ratePercent) {
  const price = toNumber(basePrice, 0);
  const rate = toNumber(ratePercent, DEFAULT_TAX_RATE);
  const withTax = price * (1 + rate / 100);
  return Number(withTax.toFixed(2));
}

function buildTaxMaps(restaurantAssignments = [], branchAssignments = [], branchProductOverrides = []) {
  const restaurantList = restaurantAssignments
    .filter((assignment) => assignment && assignment.is_active !== false)
    .sort((a, b) => toNumber(a.priority, 100) - toNumber(b.priority, 100));

  const restaurantDefault =
    restaurantList.find((item) => item.is_default) || restaurantList[0] || null;

  const branchMap = branchAssignments.reduce((acc, assignment) => {
    if (!assignment || assignment.is_active === false) return acc;
    const list = acc[assignment.branch_id] || [];
    list.push(assignment);
    acc[assignment.branch_id] = list.sort(
      (a, b) => toNumber(a.priority, 100) - toNumber(b.priority, 100),
    );
    return acc;
  }, {});

  const branchProductMap = branchProductOverrides.reduce((acc, override) => {
    if (!override || override.is_active === false) return acc;
    const key = `${override.branch_id}:${override.product_id}`;
    const list = acc[key] || [];
    list.push(override);
    acc[key] = list.sort(
      (a, b) => toNumber(a.priority, 40) - toNumber(b.priority, 40),
    );
    return acc;
  }, {});

  const resolve = (branchId, productId) => {
    const overrideList = branchProductMap[`${branchId}:${productId}`];
    if (overrideList && overrideList.length) {
      const candidate = overrideList.find((item) => item.rate_percent !== null) || overrideList[0];
      if (candidate && candidate.rate_percent !== null) {
        return toNumber(candidate.rate_percent, DEFAULT_TAX_RATE);
      }
    }

    const branchList = branchMap[branchId];
    if (branchList && branchList.length) {
      const branchDefault =
        branchList.find((item) => item.is_default) || branchList.find((item) => item.rate_percent !== null);
      if (branchDefault && branchDefault.rate_percent !== null) {
        return toNumber(branchDefault.rate_percent, DEFAULT_TAX_RATE);
      }
    }

    if (restaurantDefault && restaurantDefault.rate_percent !== null) {
      return toNumber(restaurantDefault.rate_percent, DEFAULT_TAX_RATE);
    }

    return DEFAULT_TAX_RATE;
  };

  return { resolve };
}

async function buildOptionMap(productIds = [], branchIds = []) {
  if (!Array.isArray(productIds) || !productIds.length) {
    return {};
  }

  const groupRows = await optionsRepository.listOptionGroupsForProducts(productIds);
  const groupIds = groupRows.map((row) => row.group_id);
  const itemRows = await optionsRepository.listOptionItemsForGroups(groupIds);
  const overrides = await optionsRepository.listBranchOptionOverrides(branchIds, productIds);

  const itemsByGroup = itemRows.reduce((acc, item) => {
    if (!item) return acc;
    const list = acc[item.group_id] || [];
    list.push({
      id: item.id,
      name: item.name,
      description: item.description || null,
      price_delta: toNumber(item.price_delta, 0),
      display_order: item.display_order,
    });
    acc[item.group_id] = list;
    return acc;
  }, {});

  const overridesByProduct = overrides.reduce((acc, override) => {
    if (!override) return acc;
    const productOverrides = acc[override.product_id] || {};
    const list = productOverrides[override.option_item_id] || [];
    list.push({
      branch_id: override.branch_id,
      branch_product_id: override.branch_product_id,
      product_id: override.product_id,
      option_item_id: override.option_item_id,
      is_available: override.is_active !== false,
      is_visible: override.is_active !== false,
      price_delta_override:
        override.price_delta === null || override.price_delta === undefined
          ? null
          : toNumber(override.price_delta, null),
    });
    productOverrides[override.option_item_id] = list;
    acc[override.product_id] = productOverrides;
    return acc;
  }, {});

  const groupsByProduct = groupRows.reduce((acc, row) => {
    if (!row) return acc;
    const productId = row.product_id;
    const items = (itemsByGroup[row.group_id] || []).map((item) => {
      const branchOverrides =
        overridesByProduct[productId]?.[item.id] || [];
      return {
        ...item,
        branch_overrides: branchOverrides,
      };
    });

    const group = {
      id: row.group_id,
      product_id: productId,
      name: row.name,
      description: row.description || null,
      selection_type: row.selection_type || 'multiple',
      min_select:
        row.min_select !== null && row.min_select !== undefined
          ? Number(row.min_select)
          : row.group_min_select !== null && row.group_min_select !== undefined
            ? Number(row.group_min_select)
            : 0,
      max_select:
        row.max_select !== null && row.max_select !== undefined
          ? Number(row.max_select)
          : row.group_max_select !== null && row.group_max_select !== undefined
            ? Number(row.group_max_select)
            : null,
      is_required:
        row.is_required !== null && row.is_required !== undefined
          ? row.is_required
          : row.group_is_required !== null && row.group_is_required !== undefined
            ? row.group_is_required
            : false,
      display_order: row.display_order,
      items,
    };

    const list = acc[productId] || [];
    list.push(group);
    acc[productId] = list.sort(
      (a, b) => toNumber(a.display_order, 32767) - toNumber(b.display_order, 32767),
    );
    return acc;
  }, {});

  return groupsByProduct;
}

function applyBranchOverridesToOptions(optionGroups = [], branchId = null, branchProductId = null) {
  if (!Array.isArray(optionGroups) || !optionGroups.length) {
    return [];
  }

  return optionGroups.map((group) => {
    if (!group) {
      return group;
    }

    const originalItems = Array.isArray(group.items) ? group.items : [];

    const mappedItems = originalItems
      .map((item) => {
        if (!item) return null;

        const basePriceDelta = toNumber(item.price_delta, 0);
        const overrides = Array.isArray(item.branch_overrides) ? item.branch_overrides : [];

        let override = null;
        if (branchProductId) {
          override =
            overrides.find(
              (entry) =>
                entry &&
                entry.branch_product_id &&
                entry.branch_product_id === branchProductId,
            ) || null;
        }
        if (!override && branchId) {
          override =
            overrides.find(
              (entry) => entry && entry.branch_id && entry.branch_id === branchId,
            ) || null;
        }

        const hasOverrideVisibility =
          override &&
          (override.is_available === false || override.is_visible === false);
        const overrideInactive = override && override.is_active === false;

        if (hasOverrideVisibility || overrideInactive) {
          return null;
        }

        const overridePrice =
          override && override.price_delta_override !== null && override.price_delta_override !== undefined
            ? override.price_delta_override
            : override && override.price_delta !== null && override.price_delta !== undefined
              ? override.price_delta
              : null;

        const effectivePriceDelta =
          overridePrice !== null && overridePrice !== undefined
            ? toNumber(overridePrice, basePriceDelta)
            : basePriceDelta;

        const clonedOverrides = overrides.map((entry) => ({ ...entry }));

        return {
          ...item,
          branch_overrides: clonedOverrides,
          base_price_delta: basePriceDelta,
          price_delta: effectivePriceDelta,
          effective_price_delta: effectivePriceDelta,
          applied_branch_override: override
            ? {
                branch_id: override.branch_id || null,
                branch_product_id: override.branch_product_id || null,
                price_delta:
                  overridePrice !== null && overridePrice !== undefined
                    ? toNumber(overridePrice, basePriceDelta)
                    : null,
                is_available:
                  override.is_available !== undefined && override.is_available !== null
                    ? override.is_available !== false
                    : override.is_active !== false,
                is_visible:
                  override.is_visible !== undefined && override.is_visible !== null
                    ? override.is_visible !== false
                    : override.is_active !== false,
              }
            : null,
        };
      })
      .filter(Boolean);

    const safeItems =
      mappedItems.length
        ? mappedItems
        : originalItems
            .map((item) => {
              if (!item) return null;
              const basePriceDelta = toNumber(item.price_delta, 0);
              const overrides = Array.isArray(item.branch_overrides)
                ? item.branch_overrides.map((entry) => ({ ...entry }))
                : [];
              return {
                ...item,
                branch_overrides: overrides,
                base_price_delta: basePriceDelta,
                price_delta: basePriceDelta,
                effective_price_delta: basePriceDelta,
                applied_branch_override: null,
              };
            })
            .filter(Boolean);

    return {
      ...group,
      branch_id: branchId,
      branch_product_id: branchProductId || null,
      items: safeItems,
    };
  });
}

async function buildComboData(restaurantId, branchIds = []) {
  const combos = await comboRepository.listCombosForRestaurant(restaurantId);
  if (!combos.length) {
    return { combos: [], branchCombosByBranch: {} };
  }

  const comboIds = combos.map((combo) => combo.id);
  const groupRows = await comboRepository.listComboGroups(comboIds);
  const groupIds = groupRows.map((group) => group.id);
  const itemRows = await comboRepository.listComboGroupItems(groupIds);
  const branchComboRows = branchIds.length
    ? await comboRepository.listBranchCombos(branchIds)
    : [];

  const itemsByGroup = itemRows.reduce((acc, item) => {
    if (!item) return acc;
    const list = acc[item.combo_group_id] || [];
    list.push({
      id: item.id,
      item_type: item.item_type,
      product_id: item.product_id || null,
      category_id: item.category_id || null,
      extra_price: toNumber(item.extra_price, 0),
    });
    acc[item.combo_group_id] = list;
    return acc;
  }, {});

  const groupsByCombo = groupRows.reduce((acc, group) => {
    if (!group) return acc;
    const list = acc[group.combo_id] || [];
    list.push({
      id: group.id,
      name: group.name,
      min_select: toNumber(group.min_select, 1),
      max_select: toNumber(group.max_select, 1),
      required: group.required !== false,
      display_order: group.display_order,
      items: itemsByGroup[group.id] || [],
    });
    acc[group.combo_id] = list.sort(
      (a, b) => toNumber(a.display_order, 32767) - toNumber(b.display_order, 32767),
    );
    return acc;
  }, {});

  const branchCombosByBranch = branchComboRows.reduce((acc, branchCombo) => {
    if (!branchCombo) return acc;
    const branchList = acc[branchCombo.branch_id] || [];
    branchList.push({
      id: branchCombo.id,
      branch_id: branchCombo.branch_id,
      combo_id: branchCombo.combo_id,
      is_available: branchCombo.is_available !== false,
      is_visible: branchCombo.is_visible !== false,
      base_price_override:
        branchCombo.base_price_override === null
          ? null
          : toNumber(branchCombo.base_price_override, null),
      display_order: branchCombo.display_order,
    });
    acc[branchCombo.branch_id] = branchList.sort(
      (a, b) => toNumber(a.display_order, 32767) - toNumber(b.display_order, 32767),
    );
    return acc;
  }, {});

  const detailedCombos = combos.map((combo) => ({
    ...combo,
    base_price: toNumber(combo.base_price, 0),
    groups: groupsByCombo[combo.id] || [],
    branch_assignments: Object.values(branchCombosByBranch)
      .flat()
      .filter((assignment) => assignment.combo_id === combo.id),
  }));

  return { combos: detailedCombos, branchCombosByBranch };
}

function buildBranchCategoryMap(branches = [], categories = []) {
  const branchIds = new Set(branches.map((branch) => branch.id));
  const map = {};

  categories.forEach((category) => {
    const assignments = Array.isArray(category.branch_assignments)
      ? category.branch_assignments
      : [];
    assignments.forEach((assignment) => {
      const branchId = assignment.branch_id || assignment.branchId;
      if (!branchId || !branchIds.has(branchId)) return;
      const list = map[branchId] || [];
      list.push({
        category_id: category.id,
        name: category.name,
        is_visible: assignment.is_visible !== false,
        is_active: assignment.is_active !== false,
        display_order: assignment.display_order,
      });
      map[branchId] = list.sort(
        (a, b) => toNumber(a.display_order, 32767) - toNumber(b.display_order, 32767),
      );
    });
  });

  return map;
}

async function getRestaurantCatalog(restaurantId, filters = {}) {
  const resolvedRestaurantId = normaliseUuid(restaurantId);
  if (!resolvedRestaurantId) return null;

  const restaurant = await restaurantRepository.findRestaurantById(resolvedRestaurantId);
  if (!restaurant) return null;

  const rawBranches = await restaurantRepository.listBranches(restaurant.id);
  const branches = rawBranches || [];
  const branchIds = branches.map((branch) => branch.id);

  const filteredBranchId = normaliseUuid(filters.branchId || filters.branch_id);

  const [
    categories,
    products,
    restaurantTaxAssignments,
    branchTaxAssignments,
    combosData,
  ] = await Promise.all([
    menuService.listCategories(restaurant.id),
    menuService.listProducts(restaurant.id, { ...filters, branchId: undefined, branch_id: undefined }),
    taxRepository.listRestaurantTaxAssignments(restaurant.id),
    branchIds.length ? taxRepository.listBranchTaxAssignments(branchIds) : [],
    buildComboData(restaurant.id, branchIds),
  ]);

  const productIds = products.map((product) => product.id);
  const [branchProductOverrides, optionMap] = await Promise.all([
    branchIds.length && productIds.length
      ? taxRepository.listBranchProductTaxOverrides(branchIds, productIds)
      : [],
    buildOptionMap(productIds, branchIds),
  ]);

  const taxResolver = buildTaxMaps(
    restaurantTaxAssignments,
    branchTaxAssignments,
    branchProductOverrides,
  );

  const branchCategoryMap = buildBranchCategoryMap(branches, categories);

  const productsWithOptions = products.map((product) => ({
    ...product,
    options: applyBranchOverridesToOptions(optionMap[product.id] || []),
  }));

  const branchProductsMap = branches.reduce((acc, branch) => {
    acc[branch.id] = [];
    return acc;
  }, {});

  productsWithOptions.forEach((product) => {
    const assignments = Array.isArray(product.branch_assignments)
      ? product.branch_assignments
      : [];

    assignments.forEach((assignment) => {
      const branchId = assignment.branch_id;
      if (!branchId || !branchProductsMap[branchId]) return;
      if (filteredBranchId && branchId !== filteredBranchId) return;

      const basePrice =
        assignment.price_mode === 'override' && assignment.base_price_override !== null
          ? toNumber(assignment.base_price_override, product.base_price)
          : product.base_price;

      const taxRate = taxResolver.resolve(branchId, product.id);
      const priceWithTax = computePriceWithTax(basePrice, taxRate);

      const branchProduct = {
        id: product.id,
        restaurant_id: product.restaurant_id,
        title: product.title,
        description: product.description,
        images: product.images,
        type: product.type,
        category_id: product.category_id,
        category: product.category,
        base_price: basePrice,
        price_mode: assignment.price_mode,
        base_price_override:
          assignment.base_price_override === null
            ? null
            : toNumber(assignment.base_price_override, null),
        price_with_tax: priceWithTax,
        tax_rate: taxRate,
        popular: product.popular,
        available: product.available !== false && assignment.is_available !== false,
        is_visible: product.is_visible !== false && assignment.is_visible !== false,
        branch_product_id: assignment.id,
        display_order: assignment.display_order,
        is_featured: assignment.is_featured === true,
        inventory_summary: {
          branch_id: branchId,
          quantity:
            assignment.quantity === undefined || assignment.quantity === null
              ? null
              : toNumber(assignment.quantity, null),
          reserved_qty:
            assignment.reserved_qty === undefined || assignment.reserved_qty === null
              ? null
              : toNumber(assignment.reserved_qty, null),
          daily_limit:
            assignment.daily_limit === undefined || assignment.daily_limit === null
              ? null
              : toNumber(assignment.daily_limit, null),
        },
        options: applyBranchOverridesToOptions(
          optionMap[product.id] || [],
          branchId,
          assignment.id,
        ),
        branch_assignment: assignment,
      };

      branchProductsMap[branchId].push(branchProduct);
    });
  });

  branches.forEach((branch) => {
    const existing = branchProductsMap[branch.id] || [];
    if (existing.length) return;

    productsWithOptions
      .filter((product) => product.restaurant_id === branch.restaurant_id)
      .forEach((product) => {
        const basePrice = toNumber(product.base_price, 0);
        const taxRate = taxResolver.resolve(branch.id, product.id);
        const priceWithTax = computePriceWithTax(basePrice, taxRate);

        existing.push({
          id: product.id,
          restaurant_id: product.restaurant_id,
          title: product.title,
          description: product.description,
          images: product.images,
          type: product.type,
          category_id: product.category_id,
          category: product.category,
          base_price: basePrice,
          price_mode: 'inherit',
          base_price_override: null,
          price_with_tax: priceWithTax,
          tax_rate: taxRate,
          popular: product.popular,
          available: product.available !== false,
          is_visible: product.is_visible !== false,
          branch_product_id: null,
          display_order: null,
          is_featured: false,
          inventory_summary: {
            branch_id: branch.id,
            quantity: null,
            reserved_qty: null,
            daily_limit: null,
          },
          options: applyBranchOverridesToOptions(
            optionMap[product.id] || [],
            branch.id,
            null,
          ),
          branch_assignment: {
            id: null,
            branch_id: branch.id,
            product_id: product.id,
            is_available: product.available !== false,
            is_visible: product.is_visible !== false,
            is_featured: false,
            display_order: null,
            price_mode: 'inherit',
            base_price_override: null,
            local_name: null,
            local_description: null,
            available_from: null,
            available_until: null,
            dayparts: null,
            created_at: null,
            updated_at: null,
            quantity: null,
            reserved_qty: null,
            min_stock: null,
            daily_limit: null,
            daily_sold: null,
          },
        });
      });

    branchProductsMap[branch.id] = existing;
  });

  const branchesWithMenu = branches
    .filter((branch) => !filteredBranchId || branch.id === filteredBranchId)
    .map((branch) => ({
      ...branch,
      categories: branchCategoryMap[branch.id] || [],
      products: (branchProductsMap[branch.id] || []).sort(
        (a, b) => toNumber(a.display_order, 32767) - toNumber(b.display_order, 32767),
      ),
      combos: (combosData.branchCombosByBranch[branch.id] || []).map((assignment) => {
        const combo = combosData.combos.find((item) => item.id === assignment.combo_id);
        const comboBasePrice = combo ? combo.base_price : 0;
        const comboRate = taxResolver.resolve(branch.id, combo?.id || null);
        const branchPrice =
          assignment.base_price_override === null
            ? comboBasePrice
            : toNumber(assignment.base_price_override, comboBasePrice);
        return {
          ...assignment,
          base_price: branchPrice,
          price_with_tax: computePriceWithTax(branchPrice, comboRate),
        };
      }),
    }));

  const categoriesForResponse = filteredBranchId
    ? categories.filter((category) =>
        (category.branch_assignments || []).some(
          (assignment) =>
            assignment &&
            assignment.branch_id === filteredBranchId &&
            assignment.is_active !== false &&
            assignment.is_visible !== false,
        ),
      )
    : categories;

  return {
    restaurant,
    categories: categoriesForResponse,
    products: productsWithOptions,
    combos: combosData.combos,
    branches: branchesWithMenu,
  };
}

async function listRestaurantCatalog(filters = {}) {
  const restaurants = await restaurantRepository.listAllRestaurants();
  if (!restaurants.length) {
    return { restaurants: [], products: [] };
  }

  const catalogEntries = await Promise.all(
    restaurants.map((restaurant) => getRestaurantCatalog(restaurant.id, filters)),
  );

  const validCatalogs = catalogEntries.filter(Boolean);
  const allProducts = validCatalogs.flatMap((catalog) => catalog.products || []);

  return {
    restaurants: validCatalogs,
    products: allProducts,
  };
}

module.exports = {
  getRestaurantCatalog,
  listRestaurantCatalog,
};
