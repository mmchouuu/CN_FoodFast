const { withTransaction } = require('../db');
const menuRepository = require('../repositories/menu.repository');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normaliseUuid(value) {
  if (!value) return null;
  if (typeof value === 'string' && UUID_REGEX.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === 'object') {
    const candidate =
      value.id ||
      value.branch_id ||
      value.branchId ||
      value.product_id ||
      value.productId ||
      null;
    return normaliseUuid(candidate);
  }
  return null;
}

function toPositiveInt(value) {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(Math.floor(numeric), 0);
}

async function decrementInventoryForOrder(payload = {}) {
  const restaurantId = normaliseUuid(payload.restaurant_id || payload.restaurantId);
  if (!restaurantId) {
    const error = new Error('restaurant_id is required');
    error.status = 400;
    throw error;
  }
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    return { updated: 0, items: [] };
  }

  const aggregated = new Map();
  const fallbackLookups = [];
  const defaultBranchId = normaliseUuid(payload.branch_id || payload.branchId);

  items.forEach((item) => {
    if (!item) return;
    const quantity = toPositiveInt(item.quantity ?? item.qty);
    if (!quantity) return;
    const branchProductId = normaliseUuid(
      item.branch_product_id || item.branchProductId || item.branchProduct,
    );
    if (branchProductId) {
      aggregated.set(branchProductId, (aggregated.get(branchProductId) || 0) + quantity);
      return;
    }
    const branchId =
      normaliseUuid(item.branch_id || item.branchId) || defaultBranchId || null;
    const productId = normaliseUuid(item.product_id || item.productId);
    if (branchId && productId) {
      fallbackLookups.push({ branchId, productId, quantity });
    }
  });

  if (!aggregated.size && !fallbackLookups.length) {
    return { updated: 0, items: [] };
  }

  return withTransaction(async (client) => {
    if (fallbackLookups.length) {
      for (const lookup of fallbackLookups) {
        // eslint-disable-next-line no-await-in-loop
        const branchProduct = await menuRepository.findBranchProductByBranchAndProduct(
          lookup.branchId,
          lookup.productId,
          client,
        );
        if (!branchProduct) continue;
        aggregated.set(
          branchProduct.id,
          (aggregated.get(branchProduct.id) || 0) + lookup.quantity,
        );
      }
    }

    if (!aggregated.size) {
      return { updated: 0, items: [] };
    }

    const branchProductIds = Array.from(aggregated.keys());
    const branchProducts = await menuRepository.findBranchProductsByIds(branchProductIds, client);
    const branchProductMap = new Map(branchProducts.map((bp) => [bp.id, bp]));

    const changes = [];
    let updated = 0;

    for (const [branchProductId, amount] of aggregated.entries()) {
      const branchProduct = branchProductMap.get(branchProductId);
      if (!branchProduct) continue;
      if (branchProduct.restaurant_id !== restaurantId) {
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const inventoryRecord = await menuRepository.decrementInventoryQuantity(
        branchProductId,
        amount,
        client,
      );
      updated += 1;
      changes.push({
        branch_product_id: branchProductId,
        branch_id: branchProduct.branch_id,
        product_id: branchProduct.product_id,
        quantity_decrement: amount,
        remaining_quantity: inventoryRecord?.quantity ?? null,
      });
    }

    return {
      updated,
      total: branchProductIds.length,
      items: changes,
    };
  });
}

module.exports = {
  decrementInventoryForOrder,
};
