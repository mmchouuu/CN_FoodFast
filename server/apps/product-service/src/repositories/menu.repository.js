const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

async function ensureCategory({ restaurantId, name, description = null, isActive = true }, client) {
  if (!restaurantId) {
    throw new Error('restaurantId is required to ensure category');
  }
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO categories (restaurant_id, name, description, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (restaurant_id, name) DO UPDATE SET
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING *
    `,
    [restaurantId, name, description, isActive !== false],
  );
  return result.rows[0];
}

async function assignCategoryToBranch(
  { branchId, categoryId, isVisible = true, isActive = true, displayOrder = null },
  client,
) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO branch_category_assignments (
        branch_id,
        category_id,
        is_visible,
        is_active,
        display_order
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (branch_id, category_id) DO UPDATE SET
        is_visible = EXCLUDED.is_visible,
        is_active = EXCLUDED.is_active,
        display_order = EXCLUDED.display_order,
        updated_at = now()
      RETURNING *
    `,
    [branchId, categoryId, isVisible !== false, isActive !== false, displayOrder],
  );
  return result.rows[0];
}

async function findCategoryById(categoryId, client) {
  if (!categoryId) return null;
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM categories
      WHERE id = $1
      LIMIT 1
    `,
    [categoryId],
  );
  return result.rows[0] || null;
}

async function createProduct({
  restaurantId,
  title,
  description = null,
  images = [],
  type = null,
  categoryId = null,
  basePrice,
  popular = false,
  available = true,
  isVisible = true,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO products (
        restaurant_id,
        title,
        description,
        images,
        type,
        category_id,
        base_price,
        popular,
        available,
        is_visible
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      restaurantId,
      title,
      description,
      images,
      type,
      categoryId,
      basePrice,
      popular,
      available,
      isVisible,
    ],
  );
  return result.rows[0];
}

async function assignProductToBranch({
  branchId,
  productId,
  isAvailable = true,
  isVisible = true,
  isFeatured = false,
  priceMode = 'inherit',
  basePriceOverride = null,
  localName = null,
  localDescription = null,
  displayOrder = null,
  availableFrom = null,
  availableUntil = null,
  dayparts = null,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO branch_products (
        branch_id,
        product_id,
        is_available,
        is_visible,
        is_featured,
        display_order,
        price_mode,
        base_price_override,
        local_name,
        local_description,
        available_from,
        available_until,
        dayparts
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (branch_id, product_id)
      DO UPDATE SET
        is_available = EXCLUDED.is_available,
        is_visible = EXCLUDED.is_visible,
        is_featured = EXCLUDED.is_featured,
        display_order = EXCLUDED.display_order,
        price_mode = EXCLUDED.price_mode,
        base_price_override = EXCLUDED.base_price_override,
        local_name = EXCLUDED.local_name,
        local_description = EXCLUDED.local_description,
        available_from = EXCLUDED.available_from,
        available_until = EXCLUDED.available_until,
        dayparts = EXCLUDED.dayparts,
        updated_at = now()
      RETURNING *
    `,
    [
      branchId,
      productId,
      isAvailable,
      isVisible,
      isFeatured,
      displayOrder,
      priceMode,
      basePriceOverride,
      localName,
      localDescription,
      availableFrom,
      availableUntil,
      dayparts,
    ],
  );
  return result.rows[0];
}

async function listCategoriesForRestaurant(restaurantId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT
        c.*,
        COUNT(DISTINCT p.id) AS product_count,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'branch_id', bca.branch_id,
              'is_visible', bca.is_visible,
              'is_active', bca.is_active,
              'display_order', bca.display_order
            )
          ) FILTER (WHERE bca.branch_id IS NOT NULL),
          '[]'::jsonb
        ) AS branch_assignments
      FROM categories c
      LEFT JOIN products p
        ON p.category_id = c.id
        AND p.restaurant_id = $1
      LEFT JOIN branch_category_assignments bca
        ON bca.category_id = c.id
      WHERE c.restaurant_id = $1
      GROUP BY c.id
      ORDER BY c.name ASC
    `,
    [restaurantId],
  );
  return result.rows;
}

async function listProductsByRestaurant(restaurantId, filters = {}, client) {
  const executor = getExecutor(client);
  const conditions = ['p.restaurant_id = $1'];
  const params = [restaurantId];
  let index = 2;

  const branchCandidate =
    filters.branchId ||
    filters.branch_id ||
    filters.branch;
  const categoryIdCandidate = filters.categoryId || filters.category_id || null;
  const categoryNameCandidate =
    typeof filters.category === 'string' && filters.category.trim().length
      ? filters.category.trim()
      : null;
  const searchCandidateRaw =
    typeof filters.search === 'string'
      ? filters.search
      : typeof filters.q === 'string'
        ? filters.q
        : null;
  const searchCandidate =
    searchCandidateRaw && searchCandidateRaw.trim().length ? searchCandidateRaw.trim() : null;

  const isUuid = (value) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

  if (branchCandidate && isUuid(branchCandidate)) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM branch_products bp
      WHERE bp.product_id = p.id
        AND bp.branch_id = $${index}
    )`);
    params.push(branchCandidate.trim());
    index += 1;
  }

  if (categoryIdCandidate && isUuid(categoryIdCandidate)) {
    conditions.push(`p.category_id = $${index}`);
    params.push(categoryIdCandidate.trim());
    index += 1;
  } else if (categoryNameCandidate && categoryNameCandidate.toLowerCase() !== 'all') {
    conditions.push(`LOWER(c.name) = LOWER($${index})`);
    params.push(categoryNameCandidate);
    index += 1;
  }

  if (searchCandidate) {
    conditions.push(`(
      p.title ILIKE $${index}
      OR p.description ILIKE $${index}
      OR c.name ILIKE $${index}
    )`);
    params.push(`%${searchCandidate}%`);
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await executor.query(
    `
      SELECT
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.restaurant_id = $1
      ${whereClause}
      ORDER BY p.created_at DESC
    `,
    params,
  );
  return result.rows;
}

async function listBranchAssignmentsForProducts(productIds = [], client) {
  if (!Array.isArray(productIds) || !productIds.length) return [];
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM branch_products
      WHERE product_id = ANY($1::uuid[])
    `,
    [productIds],
  );
  return result.rows;
}

async function updateProduct(productId, fields = {}, client) {
  const executor = getExecutor(client);
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return null;
  }
  const columns = [];
  const values = [];
  entries.forEach(([key, value]) => {
    let column = key;
    switch (key) {
      case 'title':
      case 'description':
      case 'images':
      case 'type':
      case 'categoryId':
      case 'basePrice':
      case 'popular':
      case 'available':
      case 'isVisible':
        column = key === 'categoryId' ? 'category_id'
          : key === 'basePrice' ? 'base_price'
          : key === 'isVisible' ? 'is_visible'
          : key;
        break;
      case 'is_active':
      case 'isActive':
        column = 'is_visible';
        value = value !== false;
        break;
      case 'base_price':
        column = 'base_price';
        break;
      default:
        column = key;
    }
    columns.push(`${column} = $${columns.length + 1}`);
    values.push(value);
  });

  if (!columns.length) return null;

  values.push(productId);
  const result = await executor.query(
    `
      UPDATE products
      SET ${columns.join(', ')}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  );
  return result.rows[0] || null;
}

async function deleteProduct(productId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      DELETE FROM products
      WHERE id = $1
      RETURNING *
    `,
    [productId],
  );
  return result.rows[0] || null;
}

async function listBranchAssignmentsForProduct(productId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM branch_products
      WHERE product_id = $1
    `,
    [productId],
  );
  return result.rows;
}

async function listInventoryForBranchProducts(branchProductIds = [], client) {
  if (!Array.isArray(branchProductIds) || !branchProductIds.length) return [];
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM inventory
      WHERE branch_product_id = ANY($1::uuid[])
    `,
    [branchProductIds],
  );
  return result.rows;
}

async function upsertInventory(branchProductId, payload = {}, client) {
  const executor = getExecutor(client);
  const existing = await executor.query(
    `
      SELECT *
      FROM inventory
      WHERE branch_product_id = $1
      LIMIT 1
    `,
    [branchProductId],
  );
  if (existing.rows.length) {
    const result = await executor.query(
      `
        UPDATE inventory
        SET
          quantity = COALESCE($2, quantity),
          reserved_qty = COALESCE($3, reserved_qty),
          min_stock = COALESCE($4, min_stock),
          daily_limit = COALESCE($5, daily_limit),
          daily_sold = COALESCE($6, daily_sold),
          is_visible = COALESCE($7, is_visible),
          is_active = COALESCE($8, is_active),
          last_restock_at = COALESCE($9, last_restock_at),
          updated_at = now()
        WHERE branch_product_id = $1
        RETURNING *
      `,
      [
        branchProductId,
        payload.quantity,
        payload.reserved_qty,
        payload.min_stock,
        payload.daily_limit,
        payload.daily_sold,
        payload.is_visible,
        payload.is_active,
        payload.last_restock_at,
      ],
    );
    return result.rows[0] || null;
  }

  const result = await executor.query(
    `
      INSERT INTO inventory (
        branch_product_id,
        quantity,
        reserved_qty,
        min_stock,
        daily_limit,
        daily_sold,
        is_visible,
        is_active,
        last_restock_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
    [
      branchProductId,
      payload.quantity ?? 0,
      payload.reserved_qty ?? 0,
      payload.min_stock ?? 10,
      payload.daily_limit ?? null,
      payload.daily_sold ?? 0,
      payload.is_visible ?? true,
      payload.is_active ?? true,
      payload.last_restock_at || null,
    ],
  );
  return result.rows[0] || null;
}

module.exports = {
  ensureCategory,
  assignCategoryToBranch,
  findCategoryById,
  createProduct,
  assignProductToBranch,
  listCategoriesForRestaurant,
  listProductsByRestaurant,
  listBranchAssignmentsForProducts,
  listBranchAssignmentsForProduct,
  listInventoryForBranchProducts,
  upsertInventory,
  updateProduct,
  deleteProduct,
};
