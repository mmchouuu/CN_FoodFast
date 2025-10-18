import pool from '../db/index.js';

const USER_SERVICE_URL = (process.env.USER_SERVICE_URL || 'http://user-service:3001').replace(/\/+$/, '');

async function httpGetJson(url) {
  try {
    const res = await (typeof fetch === 'function'
      ? fetch(url)
      : (await import('node-fetch')).default(url));
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      throw new Error(`Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[product-service] Failed to fetch', url, err.message);
    return null;
  }
}

const SELECT_RESTAURANT_BASE = `
  SELECT id,
         owner_id,
         name,
         description,
         cuisine,
         phone,
         email,
         images,
         is_active,
         avg_branch_rating,
         total_branch_ratings,
         created_at,
         updated_at
  FROM restaurants
`;

function normaliseImages(images) {
  if (!images) return null;
  if (Array.isArray(images)) {
    return images.length ? images : null;
  }
  if (typeof images === 'string') {
    return images.trim() ? [images.trim()] : null;
  }
  return null;
}

function sanitiseText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function mapOpeningHours(rows) {
  return rows.map((row) => ({
    id: row.id,
    branchId: row.branch_id,
    dayOfWeek: row.day_of_week,
    openTime: row.open_time,
    closeTime: row.close_time,
    isClosed: row.is_closed,
    overnight: row.overnight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapSpecialHours(rows) {
  return rows.map((row) => ({
    id: row.id,
    branchId: row.branch_id,
    date: row.on_date,
    openTime: row.open_time,
    closeTime: row.close_time,
    isClosed: row.is_closed,
    overnight: row.overnight,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function fetchOwnerAccount(ownerId) {
  if (!ownerId) return null;
  const url = `${USER_SERVICE_URL}/api/restaurants/owners/${ownerId}`;
  return httpGetJson(url);
}

function mapOwnerAccount(account) {
  if (!account) return null;
  return {
    id: account.id || null,
    email: account.email || null,
    phone: account.phone || null,
    managerName: account.managerName || null,
    restaurantName: account.restaurantName || null,
    companyAddress: account.companyAddress || null,
    taxCode: account.taxCode || null,
    restaurantStatus: account.restaurantStatus || null,
    isApproved: account.isApproved ?? null,
    isActive: account.isActive ?? null,
    isVerified: account.isVerified ?? null,
  };
}

async function hydrateBranches(client, restaurantId) {
  const branchesRes = await client.query(
    `SELECT id,
            restaurant_id,
            branch_number,
            name,
            brand_phone,
            brand_email,
            images,
            street,
            ward,
            district,
            city,
            latitude,
            longitude,
            is_primary,
            is_open,
            rating,
            created_at,
            updated_at
     FROM restaurant_branches
     WHERE restaurant_id = $1
     ORDER BY branch_number ASC`,
    [restaurantId],
  );

  const branches = branchesRes.rows;
  if (!branches.length) return [];

  const branchIds = branches.map((branch) => branch.id);
  const openingRes = await client.query(
    `SELECT *
     FROM branch_opening_hours
     WHERE branch_id = ANY($1::uuid[])
     ORDER BY day_of_week ASC`,
    [branchIds],
  );
  const specialRes = await client.query(
    `SELECT *
     FROM branch_special_hours
     WHERE branch_id = ANY($1::uuid[])
     ORDER BY on_date ASC`,
    [branchIds],
  );

  const openingMap = openingRes.rows.reduce((acc, row) => {
    acc[row.branch_id] = acc[row.branch_id] || [];
    acc[row.branch_id].push(row);
    return acc;
  }, {});

  const specialMap = specialRes.rows.reduce((acc, row) => {
    acc[row.branch_id] = acc[row.branch_id] || [];
    acc[row.branch_id].push(row);
    return acc;
  }, {});

  return branches.map((branch) => ({
    id: branch.id,
    restaurantId: branch.restaurant_id,
    branchNumber: branch.branch_number,
    name: branch.name,
    brandPhone: branch.brand_phone,
    brandEmail: branch.brand_email,
    images: branch.images,
    street: branch.street,
    ward: branch.ward,
    district: branch.district,
    city: branch.city,
    latitude: branch.latitude,
    longitude: branch.longitude,
    isPrimary: branch.is_primary,
    isOpen: branch.is_open,
    rating: branch.rating,
    createdAt: branch.created_at,
    updatedAt: branch.updated_at,
    openingHours: mapOpeningHours(openingMap[branch.id] || []),
    specialHours: mapSpecialHours(specialMap[branch.id] || []),
  }));
}

export async function getAllRestaurants() {
  const { rows } = await pool.query(`${SELECT_RESTAURANT_BASE} ORDER BY created_at DESC`);
  return rows;
}

export async function getRestaurantsByOwner(ownerId) {
  const { rows } = await pool.query(
    `${SELECT_RESTAURANT_BASE} WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId],
  );
  if (!rows.length) {
    return [];
  }
  const owner = mapOwnerAccount(await fetchOwnerAccount(ownerId));
  return rows.map((restaurant) => ({
    ...restaurant,
    owner,
  }));
}

export async function getRestaurantById(id, { includeBranches = true } = {}) {
  const client = await pool.connect();
  let restaurant = null;
  let branches = [];
  try {
    const res = await client.query(`${SELECT_RESTAURANT_BASE} WHERE id = $1`, [id]);
    if (!res.rowCount) {
      return null;
    }
    restaurant = res.rows[0];
    if (includeBranches) {
      branches = await hydrateBranches(client, id);
    }
  } finally {
    client.release();
  }

  if (!restaurant) {
    return null;
  }

  const ownerAccount = mapOwnerAccount(await fetchOwnerAccount(restaurant.owner_id));
  const payload = { ...restaurant, owner: ownerAccount };
  if (includeBranches) {
    payload.branches = branches;
  }
  return payload;
}

export async function getRestaurantByOwner(ownerId) {
  const client = await pool.connect();
  let restaurant = null;
  let branches = [];
  try {
    const res = await client.query(
      `${SELECT_RESTAURANT_BASE} WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [ownerId],
    );
    if (res.rowCount) {
      restaurant = res.rows[0];
      branches = await hydrateBranches(client, restaurant.id);
    }
  } finally {
    client.release();
  }

  const account = await fetchOwnerAccount(ownerId);
  const owner = mapOwnerAccount(account);

  if (restaurant) {
    return {
      ...restaurant,
      branches,
      owner,
    };
  }

  if (!account) return null;

  return {
    owner_id: ownerId,
    name: account.restaurantName || null,
    description: null,
    cuisine: null,
    phone: account.phone || null,
    email: account.email || null,
    images: null,
    is_active: account.isActive ?? false,
    restaurant_status: account.restaurantStatus || null,
    manager_name: account.managerName || null,
    pending_profile: true,
    branches: [],
    owner,
  };
}

export async function createRestaurant(data) {
  const {
    ownerId,
    name,
    description = null,
    cuisine = null,
    phone = null,
    email = null,
    images = null,
  } = data;

  if (!ownerId) throw new Error('ownerId is required');
  const trimmedName = sanitiseText(name);
  if (!trimmedName) throw new Error('Restaurant name is required');

  const imageArray = normaliseImages(images);

  const query = `
    INSERT INTO restaurants (owner_id, name, description, cuisine, phone, email, images)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [
    ownerId,
    trimmedName,
    sanitiseText(description),
    sanitiseText(cuisine),
    sanitiseText(phone),
    sanitiseText(email),
    imageArray,
  ];

  const { rows } = await pool.query(query, values);
  return getRestaurantById(rows[0].id);
}

export async function updateRestaurant(id, data) {
  const fields = [];
  const values = [];
  let index = 1;

  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    fields.push(`name = $${index++}`);
    values.push(sanitiseText(data.name));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    fields.push(`description = $${index++}`);
    values.push(sanitiseText(data.description));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'cuisine')) {
    fields.push(`cuisine = $${index++}`);
    values.push(sanitiseText(data.cuisine));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'phone')) {
    fields.push(`phone = $${index++}`);
    values.push(sanitiseText(data.phone));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'email')) {
    fields.push(`email = $${index++}`);
    values.push(sanitiseText(data.email));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'images')) {
    fields.push(`images = $${index++}`);
    values.push(normaliseImages(data.images));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'is_active')) {
    fields.push(`is_active = $${index++}`);
    values.push(data.is_active);
  }

  if (!fields.length) {
    return getRestaurantById(id);
  }

  fields.push('updated_at = now()');
  values.push(id);

  const query = `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
  const { rows } = await pool.query(query, values);
  if (!rows.length) {
    return null;
  }
  return getRestaurantById(rows[0].id);
}

export async function deleteRestaurant(id) {
  await pool.query('DELETE FROM restaurants WHERE id = $1', [id]);
  return { message: 'Restaurant deleted successfully' };
}

export async function getBranchesForRestaurant(restaurantId) {
  const client = await pool.connect();
  try {
    return await hydrateBranches(client, restaurantId);
  } finally {
    client.release();
  }
}

export async function createRestaurantBranch(restaurantId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const branchName = sanitiseText(payload.name);
    if (!branchName) {
      throw new Error('Branch name is required');
    }

    const maxRes = await client.query(
      'SELECT COALESCE(MAX(branch_number), 0) AS max_number, COUNT(*) AS total FROM restaurant_branches WHERE restaurant_id = $1',
      [restaurantId],
    );

    const nextNumber = parseInt(maxRes.rows[0].max_number, 10) + 1;
    const totalExisting = parseInt(maxRes.rows[0].total, 10);

    let isPrimary = payload.isPrimary;
    if (totalExisting === 0) {
      isPrimary = true;
    } else if (isPrimary) {
      await client.query('UPDATE restaurant_branches SET is_primary = FALSE WHERE restaurant_id = $1', [restaurantId]);
    }

    let branchNumber = Number.isInteger(payload.branchNumber)
      ? payload.branchNumber
      : Number.parseInt(payload.branchNumber, 10);
    if (Number.isNaN(branchNumber) || branchNumber <= 0) {
      branchNumber = nextNumber;
    } else {
      const exists = await client.query(
        'SELECT 1 FROM restaurant_branches WHERE restaurant_id = $1 AND branch_number = $2',
        [restaurantId, branchNumber],
      );
      if (exists.rowCount) {
        throw new Error('Branch number already exists for this restaurant');
      }
    }

    const branchImages = normaliseImages(payload.images);

    const branchIsOpen = payload.isOpen === true;

    const branchInsert = await client.query(
      `INSERT INTO restaurant_branches (
        restaurant_id,
        branch_number,
        name,
        brand_phone,
        brand_email,
        images,
        street,
        ward,
        district,
        city,
        latitude,
        longitude,
        is_primary,
        is_open
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, FALSE))
      RETURNING *`,
      [
        restaurantId,
        branchNumber,
        branchName,
        sanitiseText(payload.brandPhone),
        sanitiseText(payload.brandEmail),
        branchImages,
        sanitiseText(payload.street),
        sanitiseText(payload.ward),
        sanitiseText(payload.district),
        sanitiseText(payload.city),
        payload.latitude ? parseFloat(payload.latitude) : null,
        payload.longitude ? parseFloat(payload.longitude) : null,
        isPrimary === true,
        branchIsOpen,
      ],
    );

    const branch = branchInsert.rows[0];

    const openingHours = Array.isArray(payload.openingHours) ? payload.openingHours : [];
    for (const hour of openingHours) {
      const day = Number(hour.dayOfWeek);
      if (Number.isNaN(day)) continue;
      await client.query(
        `INSERT INTO branch_opening_hours (branch_id, day_of_week, open_time, close_time, is_closed, overnight)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          branch.id,
          day,
          hour.openTime || null,
          hour.closeTime || null,
          hour.isClosed === true,
          hour.overnight === true,
        ],
      );
    }

    const specialHours = Array.isArray(payload.specialHours) ? payload.specialHours : [];
    for (const special of specialHours) {
      if (!special.date) continue;
      await client.query(
        `INSERT INTO branch_special_hours (branch_id, on_date, open_time, close_time, is_closed, overnight, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          branch.id,
          special.date,
          special.openTime || null,
          special.closeTime || null,
          special.isClosed === true,
          special.overnight === true,
          sanitiseText(special.note),
        ],
      );
    }

    await client.query('COMMIT');

    const branches = await hydrateBranches(client, restaurantId);
    return branches.find((item) => item.id === branch.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRestaurantBranch(restaurantId, branchId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      'SELECT * FROM restaurant_branches WHERE id = $1 AND restaurant_id = $2',
      [branchId, restaurantId],
    );
    if (!existingRes.rowCount) {
      throw new Error('Branch not found for this restaurant');
    }
    const existing = existingRes.rows[0];

    let branchNumber = existing.branch_number;
    if (Object.prototype.hasOwnProperty.call(payload, 'branchNumber')) {
      const candidate = Number.isInteger(payload.branchNumber)
        ? payload.branchNumber
        : Number.parseInt(payload.branchNumber, 10);
      if (!Number.isNaN(candidate) && candidate > 0 && candidate !== branchNumber) {
        const numberExists = await client.query(
          'SELECT 1 FROM restaurant_branches WHERE restaurant_id = $1 AND branch_number = $2 AND id <> $3',
          [restaurantId, candidate, branchId],
        );
        if (numberExists.rowCount) {
          throw new Error('Branch number already exists for this restaurant');
        }
        branchNumber = candidate;
      }
    }

    if (payload.isPrimary === true) {
      await client.query(
        'UPDATE restaurant_branches SET is_primary = FALSE WHERE restaurant_id = $1 AND id <> $2',
        [restaurantId, branchId],
      );
    }

    const updates = [];
    const values = [];
    let index = 1;

    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      updates.push(`name = $${index++}`);
      values.push(sanitiseText(payload.name));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'brandPhone')) {
      updates.push(`brand_phone = $${index++}`);
      values.push(sanitiseText(payload.brandPhone));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'brandEmail')) {
      updates.push(`brand_email = $${index++}`);
      values.push(sanitiseText(payload.brandEmail));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'images')) {
      updates.push(`images = $${index++}`);
      values.push(normaliseImages(payload.images));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'street')) {
      updates.push(`street = $${index++}`);
      values.push(sanitiseText(payload.street));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'ward')) {
      updates.push(`ward = $${index++}`);
      values.push(sanitiseText(payload.ward));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'district')) {
      updates.push(`district = $${index++}`);
      values.push(sanitiseText(payload.district));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'city')) {
      updates.push(`city = $${index++}`);
      values.push(sanitiseText(payload.city));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'latitude')) {
      updates.push(`latitude = $${index++}`);
      values.push(payload.latitude !== null && payload.latitude !== undefined
        ? parseFloat(payload.latitude)
        : null);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'longitude')) {
      updates.push(`longitude = $${index++}`);
      values.push(payload.longitude !== null && payload.longitude !== undefined
        ? parseFloat(payload.longitude)
        : null);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'isPrimary')) {
      updates.push(`is_primary = $${index++}`);
      values.push(payload.isPrimary === true);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'isOpen')) {
      updates.push(`is_open = $${index++}`);
      values.push(payload.isOpen === true);
    }
    if (branchNumber !== existing.branch_number) {
      updates.push(`branch_number = $${index++}`);
      values.push(branchNumber);
    }

    if (updates.length) {
      updates.push('updated_at = now()');
      values.push(branchId);
      await client.query(
        `UPDATE restaurant_branches SET ${updates.join(', ')} WHERE id = $${index}`,
        values,
      );
    } else {
      await client.query('UPDATE restaurant_branches SET updated_at = now() WHERE id = $1', [branchId]);
    }

    if (Array.isArray(payload.openingHours)) {
      await client.query('DELETE FROM branch_opening_hours WHERE branch_id = $1', [branchId]);
      for (const hour of payload.openingHours) {
        const day = Number(hour.dayOfWeek);
        if (Number.isNaN(day)) continue;
        await client.query(
          `INSERT INTO branch_opening_hours (branch_id, day_of_week, open_time, close_time, is_closed, overnight)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            branchId,
            day,
            hour.openTime || null,
            hour.closeTime || null,
            hour.isClosed === true,
            hour.overnight === true,
          ],
        );
      }
    }

    if (Array.isArray(payload.specialHours)) {
      await client.query('DELETE FROM branch_special_hours WHERE branch_id = $1', [branchId]);
      for (const special of payload.specialHours) {
        if (!special.date) continue;
        await client.query(
          `INSERT INTO branch_special_hours (branch_id, on_date, open_time, close_time, is_closed, overnight, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            branchId,
            special.date,
            special.openTime || null,
            special.closeTime || null,
            special.isClosed === true,
            special.overnight === true,
            sanitiseText(special.note),
          ],
        );
      }
    }

    await client.query('COMMIT');

    const branches = await hydrateBranches(client, restaurantId);
    return branches.find((item) => item.id === branchId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
