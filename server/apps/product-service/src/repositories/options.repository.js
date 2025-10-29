const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

async function createOptionGroup({
  restaurantId,
  name,
  description = null,
  selectionType = 'multiple',
  minSelect = 0,
  maxSelect = null,
  isRequired = false,
  isActive = true,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO option_groups (
        restaurant_id,
        name,
        description,
        selection_type,
        min_select,
        max_select,
        is_required,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      restaurantId,
      name,
      description,
      selectionType,
      minSelect,
      maxSelect,
      isRequired,
      isActive,
    ],
  );
  return result.rows[0];
}

async function createOptionItem({
  groupId,
  name,
  description = null,
  priceDelta = 0,
  isActive = true,
  displayOrder = null,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO option_items (
        group_id,
        name,
        description,
        price_delta,
        is_active,
        display_order
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (group_id, name)
      DO UPDATE SET
        description = EXCLUDED.description,
        price_delta = EXCLUDED.price_delta,
        is_active = EXCLUDED.is_active,
        display_order = EXCLUDED.display_order,
        updated_at = now()
      RETURNING *
    `,
    [groupId, name, description, priceDelta, isActive, displayOrder],
  );
  return result.rows[0];
}

async function attachGroupToProduct({
  productId,
  groupId,
  minSelect = null,
  maxSelect = null,
  isRequired = null,
  displayOrder = null,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO product_option_groups (
        product_id,
        group_id,
        min_select,
        max_select,
        is_required,
        display_order,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,TRUE)
      ON CONFLICT (product_id, group_id)
      DO UPDATE SET
        min_select = COALESCE(EXCLUDED.min_select, product_option_groups.min_select),
        max_select = COALESCE(EXCLUDED.max_select, product_option_groups.max_select),
        is_required = COALESCE(EXCLUDED.is_required, product_option_groups.is_required),
        display_order = EXCLUDED.display_order,
        is_active = TRUE,
        updated_at = now()
      RETURNING *
    `,
    [productId, groupId, minSelect, maxSelect, isRequired, displayOrder],
  );
  return result.rows[0];
}

async function upsertBranchOptionOverride({
  branchId,
  productId,
  optionItemId,
  isAvailable = true,
  priceDeltaOverride = null,
  isVisible = true,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO branch_product_option_items (
        branch_id,
        product_id,
        option_item_id,
        is_available,
        price_delta_override,
        is_visible
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (branch_id, product_id, option_item_id)
      DO UPDATE SET
        is_available = EXCLUDED.is_available,
        price_delta_override = EXCLUDED.price_delta_override,
        is_visible = EXCLUDED.is_visible,
        updated_at = now()
      RETURNING *
    `,
    [branchId, productId, optionItemId, isAvailable, priceDeltaOverride, isVisible],
  );
  return result.rows[0];
}

async function listOptionGroupsForProducts(productIds = [], client) {
  if (!Array.isArray(productIds) || !productIds.length) return [];
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT
        pog.id,
        pog.product_id,
        pog.group_id,
        pog.min_select,
        pog.max_select,
        pog.is_required,
        pog.display_order,
        pog.is_active,
        og.restaurant_id,
        og.name,
        og.description,
        og.selection_type,
        og.min_select AS group_min_select,
        og.max_select AS group_max_select,
        og.is_required AS group_is_required,
        og.is_active AS group_is_active
      FROM product_option_groups pog
      JOIN option_groups og ON og.id = pog.group_id
      WHERE pog.product_id = ANY($1::uuid[])
        AND pog.is_active = TRUE
        AND og.is_active = TRUE
      ORDER BY pog.product_id, COALESCE(pog.display_order, 32767), og.name
    `,
    [productIds],
  );
  return result.rows;
}

async function listOptionItemsForGroups(groupIds = [], client) {
  if (!Array.isArray(groupIds) || !groupIds.length) return [];
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT
        oi.id,
        oi.group_id,
        oi.name,
        oi.description,
        oi.price_delta,
        oi.is_active,
        oi.display_order
      FROM option_items oi
      WHERE oi.group_id = ANY($1::uuid[])
        AND oi.is_active = TRUE
      ORDER BY COALESCE(oi.display_order, 32767), oi.name
    `,
    [groupIds],
  );
  return result.rows;
}

async function listBranchOptionOverrides(branchIds = [], productIds = [], client) {
  if (
    !Array.isArray(branchIds) ||
    !branchIds.length ||
    !Array.isArray(productIds) ||
    !productIds.length
  ) {
    return [];
  }
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT
        bpoi.*
      FROM branch_product_option_items bpoi
      WHERE bpoi.branch_id = ANY($1::uuid[])
        AND bpoi.product_id = ANY($2::uuid[])
    `,
    [branchIds, productIds],
  );
  return result.rows;
}

module.exports = {
  createOptionGroup,
  createOptionItem,
  attachGroupToProduct,
  upsertBranchOptionOverride,
  listOptionGroupsForProducts,
  listOptionItemsForGroups,
  listBranchOptionOverrides,
};
