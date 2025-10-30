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
