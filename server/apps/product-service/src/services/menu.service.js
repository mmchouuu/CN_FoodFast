const { withTransaction } = require('../db');
const menuRepository = require('../repositories/menu.repository');
const restaurantRepository = require('../repositories/restaurant.repository');
const optionsRepository = require('../repositories/options.repository');
const comboRepository = require('../repositories/combo.repository');
const promotionRepository = require('../repositories/promotion.repository');
const { publishSocketEvent } = require('../utils/rabbitmq');

function assert(value, message) {
  if (!value) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
}

function mapBranchAssignment(row, inventory) {
  if (!row) return null;
  return {
    id: row.id,
    branch_id: row.branch_id,
    product_id: row.product_id,
    is_available: row.is_available,
    is_visible: row.is_visible,
    is_featured: row.is_featured,
    display_order: row.display_order,
    price_mode: row.price_mode,
    base_price_override: row.base_price_override,
    local_name: row.local_name,
    local_description: row.local_description,
    available_from: row.available_from,
    available_until: row.available_until,
    dayparts: row.dayparts,
    created_at: row.created_at,
    updated_at: row.updated_at,
    quantity: inventory?.quantity ?? row.quantity ?? 0,
    reserved_qty: inventory?.reserved_qty ?? row.reserved_qty ?? 0,
    min_stock: inventory?.min_stock ?? null,
    daily_limit: inventory?.daily_limit ?? null,
    daily_sold: inventory?.daily_sold ?? null,
  };
}

function mapProductRow(row, branchAssignments = []) {
  if (!row) return null;
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    title: row.title,
    description: row.description,
    images: Array.isArray(row.images) ? row.images : [],
    type: row.type,
    category_id: row.category_id,
    category: row.category_name || null,
    base_price: Number(row.base_price),
    popular: row.popular,
    available: row.available,
    is_visible: row.is_visible,
    is_active: row.available !== false && row.is_visible !== false,
    branch_assignments: branchAssignments.map(mapBranchAssignment).filter(Boolean),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function mapCategoryRow(row) {
  if (!row) return null;
  const assignments = parseJsonArray(row.branch_assignments ?? row.branchAssignments).map(
    (assignment) => {
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
        display_order:
          assignment.display_order ?? assignment.displayOrder ?? null,
      };
    },
  ).filter(Boolean);
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    description: row.description,
    is_active: row.is_active !== false,
    productCount: Number(row.product_count ?? row.productCount ?? 0),
    branch_assignments: assignments,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createCategory(restaurantId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(payload.name, 'Category name is required');

  const name = String(payload.name).trim();
  assert(name.length, 'Category name cannot be empty');

  const description = payload.description || null;
  const categoryActive = payload.isActive ?? payload.is_active;
  const assignmentVisible = payload.isVisible ?? payload.is_visible;
  const displayOrder = payload.displayOrder ?? payload.display_order ?? null;

  const branchIdSet = new Set();
  const pushBranchCandidate = (candidate) => {
    if (!candidate) return;
    const value = typeof candidate === 'string' ? candidate.trim() : candidate?.id || candidate?.branch_id;
    if (typeof value === 'string' && value.trim().length) {
      branchIdSet.add(value.trim());
    }
  };

  if (Array.isArray(payload.branchIds)) {
    payload.branchIds.forEach(pushBranchCandidate);
  }
  pushBranchCandidate(payload.branchId);
  pushBranchCandidate(payload.branch_id);

  const { category, assignments } = await withTransaction(async (client) => {
    const categoryRow = await menuRepository.ensureCategory(
      {
        restaurantId,
        name,
        description,
        isActive: categoryActive !== false,
      },
      client,
    );

    const assignmentRows = [];
    for (const branchId of branchIdSet) {
      // eslint-disable-next-line no-await-in-loop
      const branch = await restaurantRepository.findBranchById(restaurantId, branchId, client);
      if (!branch) {
        const error = new Error('Branch not found for restaurant');
        error.status = 404;
        throw error;
      }
      // eslint-disable-next-line no-await-in-loop
      const assignment = await menuRepository.assignCategoryToBranch(
        {
          branchId,
          categoryId: categoryRow.id,
          isVisible: assignmentVisible !== false,
          isActive: categoryActive !== false,
          displayOrder,
        },
        client,
      );
      assignmentRows.push(assignment);
    }

    return { category: categoryRow, assignments: assignmentRows };
  });

  const mapped = mapCategoryRow({
    ...category,
    product_count: category.product_count ?? 0,
    branch_assignments: assignments,
  });

  publishSocketEvent(
    'menu.category.created',
    {
      restaurantId,
      category: mapped,
    },
    [`restaurant:${restaurantId}`],
  );
  return mapped;
}

async function createProduct(restaurantId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(payload.title, 'Product title is required');
  const basePrice = Number(
    payload.basePrice ??
      payload.base_price,
  );
  if (!Number.isFinite(basePrice)) {
    const error = new Error('basePrice must be numeric');
    error.status = 400;
    throw error;
  }

  const product = await withTransaction(async (client) => {
    let categoryId = payload.categoryId || null;
    if (!categoryId && payload.categoryName) {
      const category = await menuRepository.ensureCategory(
        {
          restaurantId,
          name: payload.categoryName,
          description: payload.categoryDescription || null,
          isActive: true,
        },
        client,
      );
      categoryId = category.id;
    } else if (!categoryId && payload.category) {
      const category = await menuRepository.ensureCategory(
        {
          restaurantId,
          name: payload.category,
          description: payload.categoryDescription || null,
          isActive: true,
        },
        client,
      );
      categoryId = category.id;
    } else if (categoryId) {
      const category = await menuRepository.findCategoryById(categoryId, client);
      if (!category || category.restaurant_id !== restaurantId) {
        const error = new Error('Category not found for restaurant');
        error.status = 400;
        throw error;
      }
    }

    const product = await menuRepository.createProduct(
      {
        restaurantId,
        title: payload.title,
        description: payload.description || null,
        images: Array.isArray(payload.images) ? payload.images : [],
        type: payload.type || null,
        categoryId,
        basePrice,
        popular: payload.popular === true,
        available: payload.available !== false,
        isVisible: payload.isVisible !== false,
      },
      client,
    );

    const toBranchId = (value) => {
      if (!value) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
      }
      if (typeof value === 'object') {
        return toBranchId(
          value.branchId ??
            value.branch_id ??
            value.branch ??
            value.id ??
            (typeof value === 'object' && value?.branch?.id),
        );
      }
      return null;
    };

    const pickBoolean = (value, fallback) => {
      if (value === undefined || value === null) return fallback;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const lowered = value.toLowerCase().trim();
        if (['false', '0', 'no', 'off'].includes(lowered)) return false;
        if (['true', '1', 'yes', 'on'].includes(lowered)) return true;
      }
      return Boolean(value);
    };

    const assignmentMap = new Map();
    const inventoryMap = new Map();

    const mergeInventory = (branchId, raw) => {
      if (!branchId || !raw) return;
      const entry = inventoryMap.get(branchId) || {};
      const toNumberOrNull = (input) => {
        if (input === undefined || input === null || input === '') return null;
        const numeric = Number(input);
        return Number.isFinite(numeric) ? numeric : null;
      };

      const setNumericField = (targetKey, ...sourceKeys) => {
        for (const key of sourceKeys) {
          if (raw[key] !== undefined && raw[key] !== null) {
            const numeric = toNumberOrNull(raw[key]);
            if (numeric !== null) {
              entry[targetKey] = numeric;
            }
            break;
          }
        }
      };

      setNumericField('quantity', 'quantity', 'qty');
      setNumericField('reserved_qty', 'reserved_qty', 'reservedQty');
      setNumericField('min_stock', 'min_stock', 'minStock');
      setNumericField('daily_limit', 'daily_limit', 'dailyLimit');
      setNumericField('daily_sold', 'daily_sold', 'dailySold');

      if (raw.last_restock_at !== undefined || raw.lastRestockAt !== undefined) {
        entry.last_restock_at = raw.last_restock_at ?? raw.lastRestockAt ?? null;
      }

      const visibleValue =
        raw.is_visible ?? raw.isVisible ?? raw.inv_visible ?? raw.invVisible ?? raw.visible;
      if (visibleValue !== undefined) {
        entry.is_visible = pickBoolean(visibleValue, true);
      }
      const activeValue = raw.is_active ?? raw.isActive ?? raw.inv_active ?? raw.invActive;
      if (activeValue !== undefined) {
        entry.is_active = pickBoolean(activeValue, true);
      }

      inventoryMap.set(branchId, entry);
    };

    const registerAssignment = (source) => {
      if (!source) return;
      if (typeof source === 'string') {
        const branchId = toBranchId(source);
        if (!branchId) return;
        if (!assignmentMap.has(branchId)) {
          assignmentMap.set(branchId, {
            branchId,
            isAvailable: payload.available !== false,
            isVisible: payload.isVisible !== false,
            isFeatured: false,
            priceMode: 'inherit',
            basePriceOverride: null,
            localName: null,
            localDescription: null,
            displayOrder: null,
            availableFrom: null,
            availableUntil: null,
            dayparts: null,
          });
        }
        return;
      }

      const branchId = toBranchId(source);
      if (!branchId) return;
      const existing = assignmentMap.get(branchId) || {
        branchId,
        isAvailable: payload.available !== false,
        isVisible: payload.isVisible !== false,
        isFeatured: false,
        priceMode: 'inherit',
        basePriceOverride: null,
        localName: null,
        localDescription: null,
        displayOrder: null,
        availableFrom: null,
        availableUntil: null,
        dayparts: null,
      };

      const assignment = {
        ...existing,
        isAvailable: pickBoolean(
          source.isAvailable ?? source.is_available,
          existing.isAvailable,
        ),
        isVisible: pickBoolean(source.isVisible ?? source.is_visible, existing.isVisible),
        isFeatured: pickBoolean(source.isFeatured ?? source.is_featured, existing.isFeatured),
        priceMode: source.priceMode || source.price_mode || existing.priceMode,
        basePriceOverride:
          source.basePriceOverride ?? source.base_price_override ?? existing.basePriceOverride,
        localName: source.localName ?? source.local_name ?? existing.localName,
        localDescription:
          source.localDescription ?? source.local_description ?? existing.localDescription,
        displayOrder: source.displayOrder ?? source.display_order ?? existing.displayOrder,
        availableFrom: source.availableFrom ?? source.available_from ?? existing.availableFrom,
        availableUntil: source.availableUntil ?? source.available_until ?? existing.availableUntil,
        dayparts: source.dayparts ?? existing.dayparts,
      };

      assignmentMap.set(branchId, assignment);

      if (source.inventory) {
        mergeInventory(branchId, source.inventory);
      } else {
        mergeInventory(branchId, source);
      }
    };

    const registerInventory = (source) => {
      if (!source) return;
      const branchId = toBranchId(source);
      if (!branchId) return;
      mergeInventory(branchId, source);
    };

    if (Array.isArray(payload.branchAssignments)) {
      payload.branchAssignments.forEach(registerAssignment);
    }
    if (Array.isArray(payload.branch_assignments)) {
      payload.branch_assignments.forEach(registerAssignment);
    }
    if (Array.isArray(payload.assignedBranchIds)) {
      payload.assignedBranchIds.forEach(registerAssignment);
    }
    if (Array.isArray(payload.assignedBranches)) {
      payload.assignedBranches.forEach(registerAssignment);
    }
    if (Array.isArray(payload.branch_inventories)) {
      payload.branch_inventories.forEach((item) => {
        registerAssignment(item);
        registerInventory(item);
      });
    }

    for (const branchId of inventoryMap.keys()) {
      if (!assignmentMap.has(branchId)) {
        assignmentMap.set(branchId, {
          branchId,
          isAvailable: payload.available !== false,
          isVisible: payload.isVisible !== false,
          isFeatured: false,
          priceMode: 'inherit',
          basePriceOverride: null,
          localName: null,
          localDescription: null,
          displayOrder: null,
          availableFrom: null,
          availableUntil: null,
          dayparts: null,
        });
      }
    }

    for (const assignment of assignmentMap.values()) {
      // eslint-disable-next-line no-await-in-loop
      const branchProduct = await menuRepository.assignProductToBranch(
        {
          branchId: assignment.branchId,
          productId: product.id,
          isAvailable: assignment.isAvailable !== false,
          isVisible: assignment.isVisible !== false,
          isFeatured: assignment.isFeatured === true,
          priceMode: assignment.priceMode || 'inherit',
          basePriceOverride:
            assignment.basePriceOverride !== undefined ? assignment.basePriceOverride : null,
          localName: assignment.localName || null,
          localDescription: assignment.localDescription || null,
          displayOrder: assignment.displayOrder || null,
          availableFrom: assignment.availableFrom || null,
          availableUntil: assignment.availableUntil || null,
          dayparts: assignment.dayparts || null,
        },
        client,
      );

      if (branchProduct?.id) {
        // eslint-disable-next-line no-await-in-loop
        await optionsRepository.syncBranchProductOptions(branchProduct.id, product.id, client);
      }

      const inventorySource = inventoryMap.get(assignment.branchId);
      if (branchProduct?.id && inventorySource) {
        const inventoryPayload = { ...inventorySource };
        // eslint-disable-next-line no-await-in-loop
        await menuRepository.upsertInventory(branchProduct.id, inventoryPayload, client);
      }
    }

    return product;
  });

  publishSocketEvent(
    'menu.product.created',
    {
      restaurantId,
      product,
    },
    [`restaurant:${restaurantId}`],
  );

  return product;
}

async function listCategories(restaurantId, filters = {}) {
  assert(restaurantId, 'restaurantId is required');
  const categories = await menuRepository.listCategoriesForRestaurant(restaurantId);
  const branchFilterRaw =
    filters.branchId ||
    filters.branch_id ||
    filters.branch ||
    null;
  const branchFilter =
    typeof branchFilterRaw === 'string' && branchFilterRaw.trim().length
      ? branchFilterRaw.trim()
      : null;

  const mapped = categories.map((category) => mapCategoryRow(category)).filter(Boolean);
  if (!branchFilter) {
    return mapped;
  }

  return mapped
    .map((category) => {
      const assignments = Array.isArray(category.branch_assignments)
        ? category.branch_assignments.filter(
            (assignment) =>
              assignment &&
              assignment.branch_id === branchFilter &&
              assignment.is_active !== false &&
              assignment.is_visible !== false,
          )
        : [];
      if (!assignments.length) return null;
      return {
        ...category,
        branch_assignments: assignments,
      };
    })
    .filter(Boolean);
}

async function listProducts(restaurantId, filters = {}) {
  assert(restaurantId, 'restaurantId is required');
  const rows = await menuRepository.listProductsByRestaurant(restaurantId, filters);
  if (!rows.length) return [];
  const productIds = rows.map((row) => row.id);
  let assignments = await menuRepository.listBranchAssignmentsForProducts(productIds);

  const branchFilterRaw =
    filters.branchId ||
    filters.branch_id ||
    filters.branch;
  const branchFilter =
    typeof branchFilterRaw === 'string' && branchFilterRaw.trim().length
      ? branchFilterRaw.trim()
      : null;
  if (branchFilter) {
    assignments = assignments.filter((assignment) => assignment.branch_id === branchFilter);
  }

  const inventoryRows = await menuRepository.listInventoryForBranchProducts(
    assignments.map((assignment) => assignment.id),
  );
  const inventoryByBp = inventoryRows.reduce((acc, item) => {
    acc[item.branch_product_id] = item;
    return acc;
  }, {});
  const assignmentsByProduct = assignments.reduce((acc, assignment) => {
    const list = acc[assignment.product_id] || [];
    list.push({
      ...assignment,
      inventory: inventoryByBp[assignment.id] || null,
    });
    acc[assignment.product_id] = list;
    return acc;
  }, {});
  return rows.map((row) =>
    mapProductRow(row, assignmentsByProduct[row.id] || []),
  );
}

async function updateProduct(restaurantId, productId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(productId, 'productId is required');

  let categoryId = payload.categoryId || null;
  if (!categoryId && payload.categoryName) {
    const category = await menuRepository.ensureCategory({
      restaurantId,
      name: payload.categoryName,
      description: payload.categoryDescription || null,
      isActive: true,
    });
    categoryId = category.id;
  } else if (!categoryId && payload.category) {
    const category = await menuRepository.ensureCategory({
      restaurantId,
      name: payload.category,
      description: payload.categoryDescription || null,
      isActive: true,
    });
    categoryId = category.id;
  } else if (categoryId) {
    const category = await menuRepository.findCategoryById(categoryId);
    if (!category || category.restaurant_id !== restaurantId) {
      const error = new Error('Category not found for restaurant');
      error.status = 400;
      throw error;
    }
  }

  const fields = {
    title: payload.title,
    description: payload.description,
    images: Array.isArray(payload.images) ? payload.images : undefined,
    type: payload.type,
    categoryId,
    basePrice: payload.basePrice ?? payload.base_price,
    popular: payload.popular,
    available: payload.available,
    isVisible: payload.isVisible ?? (payload.is_active !== undefined ? payload.is_active : undefined),
  };

  const updated = await menuRepository.updateProduct(productId, fields);
  if (!updated) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }
  return mapProductRow(updated);
}

async function deleteProduct(restaurantId, productId) {
  assert(restaurantId, 'restaurantId is required');
  assert(productId, 'productId is required');
  const deleted = await menuRepository.deleteProduct(productId);
  if (!deleted) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }
  return deleted;
}

async function listProductInventory(restaurantId, productId) {
  assert(restaurantId, 'restaurantId is required');
  assert(productId, 'productId is required');
  const rows = await menuRepository.listBranchAssignmentsForProduct(productId);
  if (!rows.length) return [];
  const inventoryRows = await menuRepository.listInventoryForBranchProducts(rows.map((row) => row.id));
  const inventoryByBp = inventoryRows.reduce((acc, item) => {
    acc[item.branch_product_id] = item;
    return acc;
  }, {});
  return rows.map((row) => mapBranchAssignment(row, inventoryByBp[row.id])).filter(Boolean);
}

async function updateProductInventory(restaurantId, branchId, productId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(branchId, 'branchId is required');
  assert(productId, 'productId is required');

  const assignment = await menuRepository.assignProductToBranch({
    branchId,
    productId,
    isAvailable: payload.is_available ?? payload.isAvailable,
    isVisible: payload.is_visible ?? payload.isVisible,
    isFeatured: payload.is_featured ?? payload.isFeatured,
    priceMode: payload.price_mode || 'inherit',
    basePriceOverride: payload.base_price_override ?? payload.basePriceOverride ?? null,
    localName: payload.local_name || payload.localName || null,
    localDescription: payload.local_description || payload.localDescription || null,
    displayOrder: payload.display_order ?? payload.displayOrder ?? null,
    availableFrom: payload.available_from || payload.availableFrom || null,
    availableUntil: payload.available_until || payload.availableUntil || null,
    dayparts: payload.dayparts || null,
  });

  if (assignment?.id) {
    await optionsRepository.syncBranchProductOptions(
      assignment.id,
      assignment.product_id || productId,
    );
  }

  let inventory = null;
  if (assignment?.id) {
    inventory = await menuRepository.upsertInventory(assignment.id, {
      quantity: payload.quantity ?? payload.qty ?? null,
      reserved_qty: payload.reserved_qty ?? payload.reservedQty ?? null,
      min_stock: payload.min_stock ?? payload.minStock ?? null,
      daily_limit: payload.daily_limit ?? payload.dailyLimit ?? null,
      daily_sold: payload.daily_sold ?? payload.dailySold ?? null,
      is_visible: payload.inv_visible ?? payload.invVisible ?? true,
      is_active: payload.inv_active ?? payload.invActive ?? true,
      last_restock_at: payload.last_restock_at ?? payload.lastRestockAt ?? null,
    });
  }

  return mapBranchAssignment(assignment, inventory);
}

async function createOptionGroupForProduct(productId, payload = {}) {
  assert(productId, 'productId is required');
  assert(payload.restaurantId, 'restaurantId is required');
  assert(payload.name, 'Option group name is required');

  const restaurantId = payload.restaurantId;

  const group = await withTransaction(async (client) => {
    const group = await optionsRepository.createOptionGroup(
      {
        restaurantId: payload.restaurantId,
        name: payload.name,
        description: payload.description || null,
        selectionType: payload.selectionType || 'multiple',
        minSelect: payload.minSelect ?? 0,
        maxSelect: payload.maxSelect ?? null,
        isRequired: payload.isRequired === true,
        isActive: payload.isActive !== false,
      },
      client,
    );

    if (Array.isArray(payload.items)) {
      for (const itemPayload of payload.items) {
        // eslint-disable-next-line no-await-in-loop
        await optionsRepository.createOptionItem(
          {
            groupId: group.id,
            name: itemPayload.name,
            description: itemPayload.description || null,
            priceDelta: itemPayload.priceDelta || 0,
            isActive: itemPayload.isActive !== false,
            displayOrder: itemPayload.displayOrder || null,
          },
          client,
        );
      }
    }

    await optionsRepository.attachGroupToProduct(
      {
        productId,
        groupId: group.id,
        minSelect: payload.minSelect ?? null,
        maxSelect: payload.maxSelect ?? null,
        isRequired: payload.isRequired ?? null,
        displayOrder: payload.displayOrder || null,
      },
      client,
    );

    const branchAssignments = await menuRepository.listBranchAssignmentsForProduct(
      productId,
      client,
    );
    const branchProductByBranchId = new Map();
    const branchProductById = new Map();

    for (const assignment of branchAssignments) {
      if (!assignment?.id) continue;
      branchProductByBranchId.set(assignment.branch_id, assignment);
      branchProductById.set(assignment.id, assignment);
      // eslint-disable-next-line no-await-in-loop
      await optionsRepository.syncBranchProductOptions(assignment.id, productId, client);
    }

    if (Array.isArray(payload.branchOverrides)) {
      for (const override of payload.branchOverrides) {
        const rawBranchProductId =
          override.branchProductId ?? override.branch_product_id ?? null;
        const rawBranchId =
          override.branchId ??
          override.branch_id ??
          override.branch?.id ??
          override.branch?.branch_id ??
          null;

        const branchAssignment =
          (rawBranchProductId && branchProductById.get(rawBranchProductId)) ||
          (rawBranchId && branchProductByBranchId.get(rawBranchId));

        if (!branchAssignment?.id) {
          // eslint-disable-next-line no-continue
          continue;
        }

        const optionItemIds = override.optionItemIds ?? override.option_item_ids ?? [];
        for (const optionItemId of optionItemIds) {
          // eslint-disable-next-line no-await-in-loop
          await optionsRepository.upsertBranchOptionOverride(
            {
              branchProductId: branchAssignment.id,
              branchId: branchAssignment.branch_id,
              productId,
              optionItemId,
              isAvailable: override.isAvailable ?? override.is_available,
              priceDeltaOverride:
                override.priceDeltaOverride ?? override.price_delta_override ?? undefined,
              isVisible: override.isVisible ?? override.is_visible,
              isActive: override.is_active,
            },
            client,
          );
        }
      }
    }

    return group;
  });

  publishSocketEvent(
    'menu.option-group.created',
    {
      restaurantId,
      productId,
      group,
    },
    [`restaurant:${restaurantId}`],
  );

  return group;
}

async function createCombo(restaurantId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(payload.name, 'Combo name is required');
  const basePrice = Number(payload.basePrice);
  if (!Number.isFinite(basePrice)) {
    const error = new Error('Combo base price must be numeric');
    error.status = 400;
    throw error;
  }

  const combo = await withTransaction(async (client) => {
    const combo = await comboRepository.createCombo(
      {
        restaurantId,
        name: payload.name,
        description: payload.description || null,
        basePrice,
        images: Array.isArray(payload.images) ? payload.images : [],
        isActive: payload.isActive !== false,
        availableFrom: payload.availableFrom || null,
        availableUntil: payload.availableUntil || null,
      },
      client,
    );

    if (Array.isArray(payload.groups)) {
      for (const groupPayload of payload.groups) {
        // eslint-disable-next-line no-await-in-loop
        const group = await comboRepository.createComboGroup(
          {
            comboId: combo.id,
            name: groupPayload.name,
            minSelect: groupPayload.minSelect ?? 1,
            maxSelect: groupPayload.maxSelect ?? 1,
            required: groupPayload.required !== false,
            displayOrder: groupPayload.displayOrder || null,
          },
          client,
        );

        for (const itemPayload of groupPayload.items || []) {
          // eslint-disable-next-line no-await-in-loop
          await comboRepository.createComboGroupItem(
            {
              comboGroupId: group.id,
              itemType: itemPayload.itemType,
              productId: itemPayload.productId || null,
              categoryId: itemPayload.categoryId || null,
              extraPrice: itemPayload.extraPrice || 0,
            },
            client,
          );
        }
      }
    }

    return combo;
  });

  publishSocketEvent(
    'menu.combo.created',
    {
      restaurantId,
      combo,
    },
    [`restaurant:${restaurantId}`],
  );

  return combo;
}

async function createPromotion(payload = {}) {
  assert(payload.scopeType, 'scopeType is required');
  assert(payload.name, 'Promotion name is required');
  assert(payload.promoType, 'promoType is required');
  assert(payload.discountType, 'discountType is required');
  const discountValue = Number(payload.discountValue);
  if (!Number.isFinite(discountValue)) {
    const error = new Error('discountValue must be numeric');
    error.status = 400;
    throw error;
  }

  const promotion = await withTransaction(async (client) => {
    const promotion = await promotionRepository.createPromotion(
      {
        scopeType: payload.scopeType,
        restaurantId: payload.restaurantId || null,
        branchId: payload.branchId || null,
        name: payload.name,
        description: payload.description || null,
        promoType: payload.promoType,
        discountType: payload.discountType,
        discountValue,
        maxDiscount: payload.maxDiscount || null,
        couponCode: payload.couponCode || null,
        stackable: payload.stackable === true,
        usageLimit: payload.usageLimit || null,
        perUserLimit: payload.perUserLimit || null,
        minOrderAmount: payload.minOrderAmount || null,
        startAt: payload.startAt || null,
        endAt: payload.endAt || null,
        daysOfWeek: payload.daysOfWeek || null,
        isActive: payload.isActive !== false,
      },
      client,
    );

    for (const target of payload.targets || []) {
      // eslint-disable-next-line no-await-in-loop
      await promotionRepository.addPromotionTarget(
        {
          promotionId: promotion.id,
          targetType: target.targetType,
          productId: target.productId || null,
          categoryId: target.categoryId || null,
          restaurantId: target.restaurantId || null,
          branchId: target.branchId || null,
        },
        client,
      );
    }

    for (const exclusion of payload.exclusions || []) {
      // eslint-disable-next-line no-await-in-loop
      await promotionRepository.addPromotionExclusion(
        {
          promotionId: promotion.id,
          excludeType: exclusion.excludeType,
          productId: exclusion.productId || null,
          categoryId: exclusion.categoryId || null,
        },
        client,
      );
    }

    return promotion;
  });

  const rooms = [];
  if (payload.restaurantId) {
    rooms.push(`restaurant:${payload.restaurantId}`);
  }
  if (payload.scopeType === 'branch' && payload.branchId) {
    rooms.push(`restaurant-branch:${payload.branchId}`);
  }
  publishSocketEvent(
    'menu.promotion.created',
    {
      restaurantId: payload.restaurantId || null,
      promotion,
    },
    rooms.length ? rooms : undefined,
  );

  return promotion;
}

module.exports = {
  createCategory,
  listCategories,
  createProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  listProductInventory,
  updateProductInventory,
  createOptionGroupForProduct,
  createCombo,
  createPromotion,
};
