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

async function syncBranchProductOptions(branchProductId, productId, client) {
  if (!branchProductId || !productId) return null;
  const executor = getExecutor(client);

  const runSafely = async (queryText, params) => {
    try {
      await executor.query(queryText, params);
      return true;
    } catch (error) {
      const isMissingTable =
        error?.code === '42P01' ||
        error?.code === '42703' ||
        /branch_product_option_(groups|items)/i.test(error?.message || '');
      if (isMissingTable) {
        return false;
      }
      throw error;
    }
  };

  const groupsSynced = await runSafely(
    `
      INSERT INTO branch_product_option_groups (
        branch_product_id,
        option_group_id,
        min_select,
        max_select,
        is_required,
        display_order,
        is_active
      )
      SELECT
        $1,
        pog.group_id,
        pog.min_select,
        pog.max_select,
        pog.is_required,
        pog.display_order,
        pog.is_active
      FROM product_option_groups pog
      WHERE pog.product_id = $2
      ON CONFLICT (branch_product_id, option_group_id)
      DO UPDATE SET
        min_select = EXCLUDED.min_select,
        max_select = EXCLUDED.max_select,
        is_required = EXCLUDED.is_required,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active
    `,
    [branchProductId, productId],
  );

  const itemsSynced = await runSafely(
    `
      INSERT INTO branch_product_option_items (
        branch_product_id,
        option_item_id,
        price_delta,
        is_active
      )
      SELECT
        $1,
        oi.id,
        oi.price_delta,
        oi.is_active
      FROM option_items oi
      JOIN product_option_groups pog ON pog.group_id = oi.group_id
      WHERE pog.product_id = $2
      ON CONFLICT (branch_product_id, option_item_id)
      DO UPDATE SET
        price_delta = EXCLUDED.price_delta,
        is_active = EXCLUDED.is_active
    `,
    [branchProductId, productId],
  );

  return groupsSynced || itemsSynced;
}

async function upsertBranchOptionOverride({
  branchId,
  branchProductId,
  productId,
  optionItemId,
  isAvailable,
  priceDeltaOverride,
  isVisible,
  isActive,
}, client) {
  const executor = getExecutor(client);
  if (!optionItemId) {
    const error = new Error('optionItemId is required');
    error.status = 400;
    throw error;
  }

  let resolvedBranchProductId = branchProductId || null;
  if (!resolvedBranchProductId) {
    if (!branchId || !productId) {
      const error = new Error('Either branchProductId or both branchId and productId are required');
      error.status = 400;
      throw error;
    }
    const branchProduct = await executor.query(
      `
        SELECT id
        FROM branch_products
        WHERE branch_id = $1
          AND product_id = $2
        LIMIT 1
      `,
      [branchId, productId],
    );
    if (!branchProduct.rows.length) {
      const error = new Error('Branch product not found for override');
      error.status = 404;
      throw error;
    }
    resolvedBranchProductId = branchProduct.rows[0].id;
  }

  const optionRow = await executor.query(
    `
      SELECT price_delta
      FROM option_items
      WHERE id = $1
      LIMIT 1
    `,
    [optionItemId],
  );
  if (!optionRow.rows.length) {
    const error = new Error('Option item not found');
    error.status = 404;
    throw error;
  }
  const defaultPriceDelta = Number(optionRow.rows[0].price_delta || 0);

  const existingRow = await executor.query(
    `
      SELECT price_delta
      FROM branch_product_option_items
      WHERE branch_product_id = $1
        AND option_item_id = $2
      LIMIT 1
    `,
    [resolvedBranchProductId, optionItemId],
  );

  let effectivePriceDelta = existingRow.rows.length
    ? Number(existingRow.rows[0].price_delta)
    : defaultPriceDelta;

  if (priceDeltaOverride === null) {
    effectivePriceDelta = defaultPriceDelta;
  } else if (priceDeltaOverride !== undefined) {
    const numericOverride = Number(priceDeltaOverride);
    if (!Number.isFinite(numericOverride)) {
      const error = new Error('priceDeltaOverride must be numeric or null');
      error.status = 400;
      throw error;
    }
    effectivePriceDelta = numericOverride;
  }

  const resolvedActive =
    typeof isActive === 'boolean'
      ? isActive
      : !(isAvailable === false || isVisible === false);

  const result = await executor.query(
    `
      INSERT INTO branch_product_option_items (
        branch_product_id,
        option_item_id,
        price_delta,
        is_active
      )
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (branch_product_id, option_item_id)
      DO UPDATE SET
        price_delta = EXCLUDED.price_delta,
        is_active = EXCLUDED.is_active
      RETURNING *
    `,
    [resolvedBranchProductId, optionItemId, effectivePriceDelta, resolvedActive !== false],
  );
  return result.rows[0];
}

async function listOptionGroupsForProducts(productIds = [], client) {
  if (!Array.isArray(productIds) || !productIds.length) return [];
  const executor = getExecutor(client);
  try {
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
  } catch (error) {
    const isMissingTable = error?.code === '42P01';
    const isLegacySchema =
      error?.code === '42703' ||
      /min_select|max_select|display_order|is_active/i.test(error?.message || '');
    if (!isLegacySchema && !isMissingTable) {
      throw error;
    }

    if (isMissingTable) {
      return [];
    }

    const result = await executor.query(
      `
        SELECT
          pog.id,
          pog.product_id,
          pog.group_id,
          NULL::SMALLINT AS min_select,
          NULL::SMALLINT AS max_select,
          COALESCE(pog.is_required, FALSE) AS is_required,
          NULL::INT AS display_order,
          TRUE AS is_active,
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
          AND og.is_active = TRUE
      `,
      [productIds],
    );
    return result.rows;
  }
}

async function listOptionItemsForGroups(groupIds = [], client) {
  if (!Array.isArray(groupIds) || !groupIds.length) return [];
  const executor = getExecutor(client);
  try {
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
  } catch (error) {
    const isLegacySchema =
      error?.code === '42703' ||
      error?.code === '42P01' ||
      /display_order/i.test(error?.message || '');
    if (!isLegacySchema) {
      throw error;
    }

    const result = await executor.query(
      `
        SELECT
          oi.id,
          oi.group_id,
          oi.name,
          oi.description,
          oi.price_delta,
          oi.is_active,
          NULL::INT AS display_order
        FROM option_items oi
        WHERE oi.group_id = ANY($1::uuid[])
          AND oi.is_active = TRUE
        ORDER BY oi.name
      `,
      [groupIds],
    );
    return result.rows;
  }
}

async function listBranchOptionGroupsForProducts(branchIds = [], productIds = [], client) {
  if (
    !Array.isArray(branchIds) ||
    !branchIds.length ||
    !Array.isArray(productIds) ||
    !productIds.length
  ) {
    return [];
  }

  const executor = getExecutor(client);
  try {
    const result = await executor.query(
      `
        SELECT
          bpog.id,
          bpog.branch_product_id,
          bpog.option_group_id AS group_id,
          bpog.min_select,
          bpog.max_select,
          bpog.is_required,
          bpog.display_order,
          bpog.is_active,
          bp.branch_id,
          bp.product_id,
          og.restaurant_id,
          og.name,
          og.description,
          og.selection_type,
          og.min_select AS group_min_select,
          og.max_select AS group_max_select,
          og.is_required AS group_is_required,
          og.is_active AS group_is_active
        FROM branch_product_option_groups bpog
        JOIN branch_products bp ON bp.id = bpog.branch_product_id
        JOIN option_groups og ON og.id = bpog.option_group_id
        WHERE bp.branch_id = ANY($1::uuid[])
          AND bp.product_id = ANY($2::uuid[])
          AND COALESCE(bpog.is_active, TRUE) = TRUE
          AND COALESCE(og.is_active, TRUE) = TRUE
      `,
      [branchIds, productIds],
    );
    return result.rows;
  } catch (error) {
    const isMissingTable = error?.code === '42P01';
    const isMissingColumn = error?.code === '42703';
    if (!isMissingTable && !isMissingColumn) {
      throw error;
    }
    return [];
  }
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
  const normalizeOverrideRow = (row = {}) => ({
    id: row.id || null,
    branch_product_id: row.branch_product_id || null,
    branch_id: row.branch_id || null,
    product_id: row.product_id || null,
    option_item_id: row.option_item_id || null,
    price_delta:
      row.price_delta !== undefined && row.price_delta !== null
        ? Number(row.price_delta)
        : row.price_delta_override !== undefined && row.price_delta_override !== null
          ? Number(row.price_delta_override)
          : null,
    is_active:
      row.is_active !== undefined && row.is_active !== null
        ? row.is_active !== false
        : (row.is_available ?? true) !== false && (row.is_visible ?? true) !== false,
    created_at: row.created_at || null,
  });

  try {
    const result = await executor.query(
      `
        SELECT
          bpoi.id,
          bpoi.branch_product_id,
          bp.branch_id,
          bp.product_id,
          bpoi.option_item_id,
          bpoi.price_delta,
          bpoi.is_active,
          bpoi.created_at
        FROM branch_product_option_items bpoi
        JOIN branch_products bp ON bp.id = bpoi.branch_product_id
        WHERE bp.branch_id = ANY($1::uuid[])
          AND bp.product_id = ANY($2::uuid[])
      `,
      [branchIds, productIds],
    );
    return result.rows.map(normalizeOverrideRow);
  } catch (error) {
    const isMissingTable = error?.code === '42P01';
    const isMissingColumn =
      error?.code === '42703' ||
      /branch_product_id/i.test(error?.message || '');

    if (!isMissingColumn && !isMissingTable) {
      throw error;
    }

    if (isMissingTable) {
      return [];
    }

    try {
      const legacyResult = await executor.query(
        `
          SELECT
            bpoi.id,
            bpoi.branch_id,
            bpoi.product_id,
            bpoi.option_item_id,
            bpoi.is_available,
            bpoi.is_visible,
            bpoi.price_delta_override,
            bpoi.created_at
          FROM branch_product_option_items bpoi
          WHERE bpoi.branch_id = ANY($1::uuid[])
            AND bpoi.product_id = ANY($2::uuid[])
        `,
        [branchIds, productIds],
      );

      return legacyResult.rows.map((row) =>
        normalizeOverrideRow({
          ...row,
          branch_product_id: null,
          price_delta: row.price_delta_override,
          is_active:
            (row.is_available ?? true) !== false && (row.is_visible ?? true) !== false,
        }),
      );
    } catch (legacyError) {
      const legacyMissingTable = legacyError?.code === '42P01';
      if (legacyMissingTable) {
        return [];
      }
      throw legacyError;
    }
  }
}

module.exports = {
  createOptionGroup,
  createOptionItem,
  attachGroupToProduct,
  upsertBranchOptionOverride,
  syncBranchProductOptions,
  listOptionGroupsForProducts,
  listOptionItemsForGroups,
  listBranchOptionGroupsForProducts,
  listBranchOptionOverrides,
};
