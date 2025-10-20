const pool = require('../db');

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const token = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(token)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(token)) return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim());
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function mapRestaurantRow(row) {
  if (!row) return null;
  return {
    ...row,
    images: toArray(row.images),
    logo: toArray(row.logo),
    is_active: row.is_active !== false,
    avg_branch_rating: toNumber(row.avg_branch_rating, 0),
    total_branch_ratings: toNumber(row.total_branch_ratings, 0),
  };
}

function mapBranchRow(row) {
  if (!row) return null;
  return {
    ...row,
    images: toArray(row.images),
    is_primary: row.is_primary === true,
    is_open: row.is_open === true,
    rating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : null,
    ratingSummary: row.avg_rating || row.total_ratings
      ? {
          avgRating: row.avg_rating !== null && row.avg_rating !== undefined
            ? Number(row.avg_rating)
            : null,
          totalRatings: row.total_ratings !== null && row.total_ratings !== undefined
            ? Number(row.total_ratings)
            : null,
        }
      : undefined,
  };
}

function mapProductRow(row) {
  if (!row) return null;
  const basePrice = toNumber(row.base_price, 0);
  return {
    ...row,
    images: toArray(row.images),
    base_price: basePrice,
    tax_rate: row.tax_rate !== null && row.tax_rate !== undefined
      ? Number(row.tax_rate)
      : null,
    tax_amount: row.tax_amount !== null && row.tax_amount !== undefined
      ? Number(row.tax_amount)
      : null,
    price_with_tax: row.price_with_tax !== null && row.price_with_tax !== undefined
      ? Number(row.price_with_tax)
      : basePrice,
    popular: toBoolean(row.popular, false),
    available: toBoolean(row.available, true),
    is_visible: toBoolean(row.is_visible, true),
    category: row.category_name || row.category || null,
    inventory_summary: {
      quantity: row.total_quantity !== undefined && row.total_quantity !== null
        ? Number(row.total_quantity)
        : null,
      reserved_qty: row.total_reserved !== undefined && row.total_reserved !== null
        ? Number(row.total_reserved)
        : null,
    },
  };
}

async function fetchRestaurants(options = {}) {
  const {
    restaurantIds,
    ownerId,
    includeBranches = false,
    includeProducts = false,
    includeBranchProducts = false,
    limit,
    offset,
  } = options;

  const filters = [];
  const params = [];
  let paramIndex = 1;

  if (Array.isArray(restaurantIds) && restaurantIds.length) {
    filters.push(`id = ANY($${paramIndex++})`);
    params.push(restaurantIds);
  }
  if (ownerId) {
    filters.push(`owner_id = $${paramIndex++}`);
    params.push(ownerId);
  }

  let query = `
    SELECT
      id,
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings,
      created_at,
      updated_at
    FROM restaurants
  `;

  if (filters.length) {
    query += ` WHERE ${filters.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';

  if (typeof limit === 'number') {
    query += ` LIMIT $${paramIndex++}`;
    params.push(limit);
  }
  if (typeof offset === 'number') {
    query += ` OFFSET $${paramIndex++}`;
    params.push(offset);
  }

  const result = await pool.query(query, params);
  const restaurants = result.rows.map(mapRestaurantRow);

  if (!restaurants.length) {
    return restaurants;
  }

  const restaurantMap = new Map();
  const restaurantIdsList = [];
  restaurants.forEach((restaurant) => {
    restaurant.products = [];
    restaurant.branches = [];
    restaurantMap.set(restaurant.id, restaurant);
    restaurantIdsList.push(restaurant.id);
  });

  const branchMap = new Map();

  if (includeBranches) {
    const branchRes = await pool.query(
      `
        SELECT
          b.*,
          avg.avg_rating,
          avg.total_ratings
        FROM restaurant_branches b
        LEFT JOIN branch_rating_avg avg ON avg.branch_id = b.id
        WHERE b.restaurant_id = ANY($1)
        ORDER BY b.restaurant_id, b.branch_number, b.created_at
      `,
      [restaurantIdsList],
    );

    branchRes.rows.forEach((row) => {
      const branch = mapBranchRow(row);
      branch.products = [];
      branchMap.set(branch.id, branch);
      const parent = restaurantMap.get(branch.restaurant_id);
      if (parent) {
        parent.branches.push(branch);
      }
    });
  }

  const productMap = new Map();

  if (includeProducts) {
    const productRes = await pool.query(
      `
        SELECT
          p.*,
          c.name AS category_name,
          inv.total_quantity,
          inv.total_reserved
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN (
          SELECT
            product_id,
            SUM(quantity) AS total_quantity,
            SUM(reserved_qty) AS total_reserved
          FROM inventory
          GROUP BY product_id
        ) inv ON inv.product_id = p.id
        WHERE p.restaurant_id = ANY($1)
        ORDER BY p.created_at DESC
      `,
      [restaurantIdsList],
    );

    productRes.rows.forEach((row) => {
      const product = mapProductRow(row);
      productMap.set(product.id, product);
      const parent = restaurantMap.get(product.restaurant_id);
      if (parent) {
        parent.products.push(product);
      }
    });

    if (includeBranchProducts && branchMap.size && productMap.size) {
      const branchIds = Array.from(branchMap.keys());
      const productIds = Array.from(productMap.keys());

      const inventoryRes = await pool.query(
        `
          SELECT
            branch_id,
            product_id,
            quantity,
            reserved_qty
          FROM inventory
          WHERE branch_id = ANY($1) AND product_id = ANY($2)
        `,
        [branchIds, productIds],
      );

      inventoryRes.rows.forEach((row) => {
        const branch = branchMap.get(row.branch_id);
        const product = productMap.get(row.product_id);
        if (!branch || !product) return;
        branch.products.push({
          ...product,
          inventory: {
            branch_id: row.branch_id,
            branchId: row.branch_id,
            quantity: row.quantity !== null && row.quantity !== undefined
              ? Number(row.quantity)
              : null,
            reserved_qty: row.reserved_qty !== null && row.reserved_qty !== undefined
              ? Number(row.reserved_qty)
              : null,
          },
        });
      });
    }
  }

  return restaurants;
}

async function getAllRestaurants(options = {}) {
  return fetchRestaurants(options);
}

async function getRestaurantById(id, options = {}) {
  const rows = await fetchRestaurants({
    ...options,
    restaurantIds: [id],
  });
  return rows[0] || null;
}

async function getRestaurantsByOwner(ownerId, options = {}) {
  return fetchRestaurants({
    ...options,
    ownerId,
  });
}

async function getRestaurantByOwner(ownerId, options = {}) {
  const rows = await fetchRestaurants({
    ...options,
    ownerId,
  });
  return rows[0] || null;
}

async function createRestaurant(payload = {}) {
  const images = toArray(payload.images);
  const logo = toArray(payload.logo);

  const res = await pool.query(
    `
      INSERT INTO restaurants (
        owner_id,
        name,
        description,
        about,
        cuisine,
        phone,
        email,
        logo,
        images,
        is_active
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      RETURNING *
    `,
    [
      payload.owner_id || payload.ownerId,
      payload.name,
      payload.description || null,
      payload.about || null,
      payload.cuisine || null,
      payload.phone || null,
      payload.email || null,
      logo,
      images,
      payload.is_active !== undefined ? toBoolean(payload.is_active, true) : true,
    ],
  );

  return mapRestaurantRow(res.rows[0]);
}

async function updateRestaurant(id, payload = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    owner_id: payload.owner_id ?? payload.ownerId,
    name: payload.name,
    description: Object.prototype.hasOwnProperty.call(payload, 'description')
      ? payload.description
      : undefined,
    about: Object.prototype.hasOwnProperty.call(payload, 'about')
      ? payload.about
      : undefined,
    cuisine: payload.cuisine,
    phone: payload.phone,
    email: payload.email,
    logo: Object.prototype.hasOwnProperty.call(payload, 'logo')
      ? toArray(payload.logo)
      : undefined,
    images: Object.prototype.hasOwnProperty.call(payload, 'images')
      ? toArray(payload.images)
      : undefined,
    is_active: Object.prototype.hasOwnProperty.call(payload, 'is_active')
      ? toBoolean(payload.is_active, true)
      : undefined,
  };

  for (const [column, value] of Object.entries(mapping)) {
    if (typeof value === 'undefined') continue;
    fields.push(`${column} = $${idx++}`);
    values.push(value);
  }

  if (!fields.length) {
    return getRestaurantById(id);
  }

  fields.push(`updated_at = now()`);

  const res = await pool.query(
    `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...values, id],
  );

  return mapRestaurantRow(res.rows[0] || null);
}

async function deleteRestaurant(id) {
  const res = await pool.query('DELETE FROM restaurants WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

async function getBranchesForRestaurant(restaurantId) {
  const res = await pool.query(
    `
      SELECT
        b.*,
        avg.avg_rating,
        avg.total_ratings
      FROM restaurant_branches b
      LEFT JOIN branch_rating_avg avg ON avg.branch_id = b.id
      WHERE b.restaurant_id = $1
      ORDER BY b.branch_number, b.created_at
    `,
    [restaurantId],
  );

  return res.rows.map((row) => {
    const branch = mapBranchRow(row);
    branch.products = [];
    return branch;
  });
}

async function createRestaurantBranch(restaurantId, payload = {}) {
  const images = toArray(payload.images || payload.imageUrl);
  const res = await pool.query(
    `
      INSERT INTO restaurant_branches (
        restaurant_id,
        branch_number,
        name,
        branch_phone,
        branch_email,
        street,
        ward,
        district,
        city,
        latitude,
        longitude,
        images,
        is_primary,
        is_open
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
      )
      RETURNING *
    `,
    [
      restaurantId,
      Number(payload.branch_number ?? payload.branchNumber ?? 1),
      payload.name || null,
      payload.branch_phone || payload.branchPhone || null,
      payload.branch_email || payload.branchEmail || null,
      payload.street || null,
      payload.ward || null,
      payload.district || null,
      payload.city || null,
      payload.latitude !== undefined && payload.latitude !== null ? Number(payload.latitude) : null,
      payload.longitude !== undefined && payload.longitude !== null ? Number(payload.longitude) : null,
      images,
      toBoolean(payload.is_primary ?? payload.isPrimary, false),
      toBoolean(payload.is_open ?? payload.isOpen, false),
    ],
  );

  return mapBranchRow(res.rows[0]);
}

async function updateRestaurantBranch(restaurantId, branchId, payload = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    branch_number: payload.branch_number ?? payload.branchNumber,
    name: payload.name,
    branch_phone: payload.branch_phone ?? payload.branchPhone,
    branch_email: payload.branch_email ?? payload.branchEmail,
    street: payload.street,
    ward: payload.ward,
    district: payload.district,
    city: payload.city,
    latitude: payload.latitude !== undefined ? Number(payload.latitude) : undefined,
    longitude: payload.longitude !== undefined ? Number(payload.longitude) : undefined,
    images: Object.prototype.hasOwnProperty.call(payload, 'images') || Object.prototype.hasOwnProperty.call(payload, 'imageUrl')
      ? toArray(payload.images || payload.imageUrl)
      : undefined,
    is_primary: Object.prototype.hasOwnProperty.call(payload, 'is_primary') || Object.prototype.hasOwnProperty.call(payload, 'isPrimary')
      ? toBoolean(payload.is_primary ?? payload.isPrimary, false)
      : undefined,
    is_open: Object.prototype.hasOwnProperty.call(payload, 'is_open') || Object.prototype.hasOwnProperty.call(payload, 'isOpen')
      ? toBoolean(payload.is_open ?? payload.isOpen, false)
      : undefined,
  };

  for (const [column, value] of Object.entries(mapping)) {
    if (typeof value === 'undefined') continue;
    fields.push(`${column} = $${idx++}`);
    values.push(value);
  }

  if (!fields.length) {
    const res = await pool.query(
      'SELECT b.*, avg.avg_rating, avg.total_ratings FROM restaurant_branches b LEFT JOIN branch_rating_avg avg ON avg.branch_id = b.id WHERE b.restaurant_id = $1 AND b.id = $2',
      [restaurantId, branchId],
    );
    return res.rows[0] ? mapBranchRow(res.rows[0]) : null;
  }

  fields.push('updated_at = now()');

  const res = await pool.query(
    `
      UPDATE restaurant_branches
      SET ${fields.join(', ')}
      WHERE restaurant_id = $${idx} AND id = $${idx + 1}
      RETURNING *
    `,
    [...values, restaurantId, branchId],
  );

  return res.rows[0] ? mapBranchRow(res.rows[0]) : null;
}

async function deleteRestaurantBranch(restaurantId, branchId) {
  const res = await pool.query(
    'DELETE FROM restaurant_branches WHERE restaurant_id = $1 AND id = $2 RETURNING id',
    [restaurantId, branchId],
  );
  return res.rows[0] || null;
}

async function create(payload = {}) {
  return createRestaurant(payload);
}

async function list(params = {}) {
  const limit = params.limit !== undefined ? Number(params.limit) : undefined;
  const offset = params.offset !== undefined ? Number(params.offset) : undefined;
  return fetchRestaurants({
    ownerId: params.ownerId || params.owner_id,
    includeBranches: params.includeBranches ?? false,
    includeProducts: params.includeProducts ?? false,
    includeBranchProducts: params.includeBranchProducts ?? false,
    limit,
    offset,
  });
}

async function get(id, options = {}) {
  return getRestaurantById(id, options);
}

async function remove(id) {
  return deleteRestaurant(id);
}

async function update(id, payload = {}) {
  return updateRestaurant(id, payload);
}

module.exports = {
  createRestaurant,
  createRestaurantBranch,
  deleteRestaurant,
  deleteRestaurantBranch,
  getAllRestaurants,
  getBranchesForRestaurant,
  getRestaurantById,
  getRestaurantByOwner,
  getRestaurantsByOwner,
  updateRestaurant,
  updateRestaurantBranch,
  create,
  list,
  get,
  update,
  remove,
};
