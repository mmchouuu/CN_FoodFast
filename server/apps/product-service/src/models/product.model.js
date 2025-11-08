import pool from '../db/index.js';

const PRODUCT_BASE_SELECT = `
  SELECT
    p.id,
    p.restaurant_id,
    p.title,
    p.description,
    p.images,
    p.type,
    p.category_id,
    c.name AS category_name,
    p.base_price,
    p.tax_rate,
    p.tax_amount,
    p.price_with_tax,
    p.is_tax_included,
    p.popular,
    p.available,
    p.is_visible,
    p.created_at,
    p.updated_at,
    COALESCE(inv.inventory_quantity, 0) AS inventory_quantity,
    COALESCE(inv.inventory_reserved, 0) AS inventory_reserved,
    COALESCE(inv.inventory_daily_sold, 0) AS inventory_daily_sold
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT
      SUM(i.quantity)       AS inventory_quantity,
      SUM(i.reserved_qty)   AS inventory_reserved,
      SUM(i.daily_sold)     AS inventory_daily_sold
    FROM inventory i
    WHERE i.product_id = p.id
  ) inv ON true
`;

function normaliseName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed.length ? trimmed : null;
}

function toImageArray(images) {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images.filter((item) => typeof item === 'string' && item.trim());
  }
  if (typeof images === 'string' && images.trim()) {
    return [images.trim()];
  }
  return [];
}

function coerceNumber(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapProductRow(row) {
  if (!row) return null;
  const mapped = {
    ...row,
    base_price: coerceNumber(row.base_price, 0),
    tax_rate: coerceNumber(row.tax_rate, 0),
    tax_amount: coerceNumber(row.tax_amount, 0),
    price_with_tax: coerceNumber(row.price_with_tax, 0),
    inventory_quantity: coerceNumber(row.inventory_quantity, 0),
    inventory_reserved: coerceNumber(row.inventory_reserved, 0),
    inventory_daily_sold: coerceNumber(row.inventory_daily_sold, 0),
    images: Array.isArray(row.images) ? row.images : toImageArray(row.images),
  };
  mapped.category = row.category_name || null;
  mapped.is_visible = row.is_visible !== false;
  mapped.available = row.available !== false;
  return mapped;
}

export async function listProducts({ limit = 20, offset = 0, restaurantId } = {}) {
  const params = [];
  let idx = 1;
  let query = `${PRODUCT_BASE_SELECT}`;

  if (restaurantId) {
    query += ` WHERE p.restaurant_id = $${idx}`;
    params.push(restaurantId);
    idx += 1;
  }

  query += ' ORDER BY p.created_at DESC';
  query += ` LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(Number(limit) || 20, Number(offset) || 0);

  const res = await pool.query(query, params);
  return res.rows.map(mapProductRow);
}

export async function getProductById(id) {
  const res = await pool.query(`${PRODUCT_BASE_SELECT} WHERE p.id = $1`, [id]);
  return mapProductRow(res.rows[0] || null);
}

export async function createProduct(data) {
  const {
    restaurant_id,
    title,
    description = null,
    images = [],
    category_id = null,
    type = null,
    base_price = 0,
    tax_rate = 0,
    is_tax_included = false,
    popular = false,
    available = true,
    is_visible = true,
  } = data;

  const imagesArray = toImageArray(images);

  const res = await pool.query(
    `INSERT INTO products (
       restaurant_id,
       title,
       description,
       images,
       type,
       category_id,
       base_price,
       tax_rate,
       is_tax_included,
       popular,
       available,
       is_visible
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      restaurant_id,
      title,
      description,
      imagesArray,
      type,
      category_id,
      Number(base_price) || 0,
      Number(tax_rate) || 0,
      Boolean(is_tax_included),
      Boolean(popular),
      available !== false,
      is_visible !== false,
    ],
  );

  return getProductById(res.rows[0].id);
}

export async function updateProduct(id, data = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    restaurant_id: data.restaurant_id,
    title: data.title,
    description: Object.prototype.hasOwnProperty.call(data, 'description')
      ? data.description
      : undefined,
    images: data.images,
    type: data.type,
    category_id: data.category_id,
    base_price: Object.prototype.hasOwnProperty.call(data, 'base_price')
      ? Number(data.base_price)
      : undefined,
    tax_rate: Object.prototype.hasOwnProperty.call(data, 'tax_rate')
      ? Number(data.tax_rate)
      : undefined,
    is_tax_included: Object.prototype.hasOwnProperty.call(data, 'is_tax_included')
      ? Boolean(data.is_tax_included)
      : undefined,
    popular: Object.prototype.hasOwnProperty.call(data, 'popular')
      ? Boolean(data.popular)
      : undefined,
    available: Object.prototype.hasOwnProperty.call(data, 'available')
      ? data.available !== false
      : undefined,
    is_visible: Object.prototype.hasOwnProperty.call(data, 'is_visible')
      ? data.is_visible !== false
      : undefined,
  };

  for (const [column, value] of Object.entries(mapping)) {
    if (typeof value === 'undefined') continue;
    if (column === 'images') {
      fields.push(`images = $${idx}`);
      values.push(toImageArray(value));
    } else {
      fields.push(`${column} = $${idx}`);
      values.push(value);
    }
    idx += 1;
  }

  if (!fields.length) {
    return getProductById(id);
  }

  fields.push('updated_at = NOW()');
  const res = await pool.query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`,
    [...values, id],
  );
  if (!res.rowCount) {
    return null;
  }
  return getProductById(res.rows[0].id);
}

export async function deleteProduct(id) {
  const res = await pool.query(
    'DELETE FROM products WHERE id = $1 RETURNING id, restaurant_id',
    [id],
  );
  return res.rows[0] || null;
}

export { pool };

export async function findCategoryById(id) {
  if (!id) return null;
  const res = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function findCategoryByName(name) {
  const normalised = normaliseName(name);
  if (!normalised) return null;
  const res = await pool.query(
    'SELECT * FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [normalised],
  );
  return res.rows[0] || null;
}

export async function createCategory({ name, description = null }) {
  const normalised = normaliseName(name);
  if (!normalised) {
    throw new Error('Category name is required');
  }
  const res = await pool.query(
    `INSERT INTO categories (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [normalised, description || null],
  );
  return res.rows[0] || null;
}

export async function listCategories({ search, restaurantId, limit = 100, offset = 0 } = {}) {
  const params = [];
  let idx = 1;

  let query = `
    SELECT DISTINCT c.id,
           c.name,
           c.description,
           c.created_at,
           c.updated_at
    FROM categories c
  `;

  if (restaurantId) {
    query += `
      JOIN products p ON p.category_id = c.id
      WHERE p.restaurant_id = $${idx}
    `;
    params.push(restaurantId);
    idx += 1;
  } else {
    query += ' WHERE 1=1';
  }

  if (search) {
    query += ` AND c.name ILIKE $${idx}`;
    params.push(`%${search}%`);
    idx += 1;
  }

  query += ' ORDER BY c.name ASC';
  query += ` LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(Number(limit) || 100, Number(offset) || 0);

  const res = await pool.query(query, params);
  return res.rows;
}

export async function updateCategory(id, { name, description } = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (typeof name !== 'undefined') {
    const normalised = normaliseName(name);
    if (!normalised) {
      throw new Error('Category name is required');
    }
    fields.push(`name = $${idx}`);
    values.push(normalised);
    idx += 1;
  }

  if (typeof description !== 'undefined') {
    fields.push(`description = $${idx}`);
    values.push(description || null);
    idx += 1;
  }

  if (!fields.length) {
    return findCategoryById(id);
  }

  fields.push('updated_at = NOW()');
  const res = await pool.query(
    `UPDATE categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...values, id],
  );
  return res.rows[0] || null;
}

export async function deleteCategory(id) {
  const res = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

export async function listInventoryByRestaurant(restaurantId) {
  const res = await pool.query(
    `
      SELECT
        i.id,
        i.branch_id,
        i.product_id,
        i.quantity,
        i.reserved_qty,
        i.min_stock,
        i.last_restock_at,
        i.daily_limit,
        i.daily_sold,
        i.is_visible,
        i.is_active,
        i.updated_at,
        b.name AS branch_name,
        b.branch_number,
        p.title AS product_title
      FROM inventory i
      JOIN restaurant_branches b ON b.id = i.branch_id
      JOIN products p ON p.id = i.product_id
      WHERE b.restaurant_id = $1
      ORDER BY b.branch_number ASC, p.title ASC
    `,
    [restaurantId],
  );
  return res.rows.map((row) => ({
    ...row,
    quantity: Number.parseInt(row.quantity, 10) || 0,
    reserved_qty: Number.parseInt(row.reserved_qty, 10) || 0,
    min_stock: row.min_stock === null ? null : Number.parseInt(row.min_stock, 10),
    daily_limit: row.daily_limit === null ? null : Number.parseInt(row.daily_limit, 10),
    daily_sold: Number.parseInt(row.daily_sold, 10) || 0,
  }));
}

export async function listInventoryByProduct(restaurantId, productId) {
  const res = await pool.query(
    `
      SELECT
        i.id,
        i.branch_id,
        i.product_id,
        i.quantity,
        i.reserved_qty,
        i.min_stock,
        i.last_restock_at,
        i.daily_limit,
        i.daily_sold,
        i.is_visible,
        i.is_active,
        i.updated_at,
        b.name AS branch_name,
        b.branch_number
      FROM inventory i
      JOIN restaurant_branches b ON b.id = i.branch_id
      WHERE b.restaurant_id = $1
        AND i.product_id = $2
      ORDER BY b.branch_number ASC
    `,
    [restaurantId, productId],
  );
  return res.rows.map((row) => ({
    ...row,
    quantity: Number.parseInt(row.quantity, 10) || 0,
    reserved_qty: Number.parseInt(row.reserved_qty, 10) || 0,
    min_stock: row.min_stock === null ? null : Number.parseInt(row.min_stock, 10),
    daily_limit: row.daily_limit === null ? null : Number.parseInt(row.daily_limit, 10),
    daily_sold: Number.parseInt(row.daily_sold, 10) || 0,
  }));
}

export async function listInventoryByBranch(restaurantId, branchId) {
  const res = await pool.query(
    `
      SELECT
        i.id,
        i.branch_id,
        i.product_id,
        i.quantity,
        i.reserved_qty,
        i.min_stock,
        i.last_restock_at,
        i.daily_limit,
        i.daily_sold,
        i.is_visible,
        i.is_active,
        i.updated_at,
        p.title AS product_title
      FROM inventory i
      JOIN restaurant_branches b ON b.id = i.branch_id
      JOIN products p ON p.id = i.product_id
      WHERE b.restaurant_id = $1
        AND i.branch_id = $2
      ORDER BY p.title ASC
    `,
    [restaurantId, branchId],
  );
  return res.rows.map((row) => ({
    ...row,
    quantity: Number.parseInt(row.quantity, 10) || 0,
    reserved_qty: Number.parseInt(row.reserved_qty, 10) || 0,
    min_stock: row.min_stock === null ? null : Number.parseInt(row.min_stock, 10),
    daily_limit: row.daily_limit === null ? null : Number.parseInt(row.daily_limit, 10),
    daily_sold: Number.parseInt(row.daily_sold, 10) || 0,
  }));
}

export async function upsertInventoryRecord({
  branch_id,
  product_id,
  quantity = null,
  reserved_qty = null,
  min_stock = null,
  last_restock_at = null,
  daily_limit = null,
  daily_sold = null,
  is_visible = true,
  is_active = true,
}) {
  const res = await pool.query(
    `
      INSERT INTO inventory (
        branch_id,
        product_id,
        quantity,
        reserved_qty,
        min_stock,
        last_restock_at,
        daily_limit,
        daily_sold,
        is_visible,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (branch_id, product_id)
      DO UPDATE SET
        quantity = COALESCE(EXCLUDED.quantity, inventory.quantity),
        reserved_qty = COALESCE(EXCLUDED.reserved_qty, inventory.reserved_qty),
        min_stock = COALESCE(EXCLUDED.min_stock, inventory.min_stock),
        last_restock_at = COALESCE(EXCLUDED.last_restock_at, inventory.last_restock_at),
        daily_limit = COALESCE(EXCLUDED.daily_limit, inventory.daily_limit),
        daily_sold = COALESCE(EXCLUDED.daily_sold, inventory.daily_sold),
        is_visible = EXCLUDED.is_visible,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
    `,
    [
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      last_restock_at,
      daily_limit,
      daily_sold,
      is_visible !== false,
      is_active !== false,
    ],
  );
  return res.rows[0] || null;
}

export async function ensureInventoryRecords(branchIds = [], productId) {
  if (!Array.isArray(branchIds) || !branchIds.length) {
    return 0;
  }
  const res = await pool.query(
    `
      INSERT INTO inventory (branch_id, product_id)
      SELECT UNNEST($1::uuid[]), $2::uuid
      ON CONFLICT (branch_id, product_id) DO NOTHING
    `,
    [branchIds, productId],
  );
  return res.rowCount || 0;
}

export async function deleteInventoryForProduct(productId) {
  await pool.query('DELETE FROM inventory WHERE product_id = $1', [productId]);
}
