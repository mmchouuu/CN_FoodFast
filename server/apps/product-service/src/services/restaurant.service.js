const db = require('../db');
const pool = db?.default || db;
const { geocodeAddress } = require('../utils/geocoding');
const { publishSocketEvent } = require('../utils/rabbitmq');

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

function parseCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
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

function mapBranchRatings(rows) {
  return rows.map((row) => ({
    id: row.id,
    branchId: row.branch_id,
    userId: row.user_id,
    orderId: row.order_id,
    ratingValue: row.rating_value !== null && row.rating_value !== undefined
      ? Number(row.rating_value)
      : null,
    comment: row.comment,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapRatingSummaryRows(rows) {
  return rows.reduce((acc, row) => {
    acc[row.branch_id] = {
      branchId: row.branch_id,
      avgRating: row.avg_rating !== null && row.avg_rating !== undefined
        ? Number(row.avg_rating)
        : null,
      totalRatings: row.total_ratings ?? 0,
      lastUpdated: row.last_updated || null,
    };
    return acc;
  }, {});
}

const ADMIN_RESTAURANT_ROOM = 'admin:restaurants';

function uniqueRooms(...lists) {
  const acc = new Set();
  lists.forEach((list) => {
    if (!list) return;
    const items = Array.isArray(list) ? list : [list];
    items.filter(Boolean).forEach((item) => acc.add(item));
  });
  return Array.from(acc);
}

function roomsForRestaurantEntity(restaurant) {
  if (!restaurant) return [ADMIN_RESTAURANT_ROOM];
  return uniqueRooms(
    ADMIN_RESTAURANT_ROOM,
    'catalog:restaurants',
    restaurant.id ? `restaurant:${restaurant.id}` : null,
    restaurant.owner_id ? `restaurant-owner:${restaurant.owner_id}` : null,
  );
}

function roomsForBranchEntity(restaurant, branch) {
  return uniqueRooms(
    roomsForRestaurantEntity(restaurant),
    branch?.id ? `restaurant-branch:${branch.id}` : null,
  );
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
            branch_phone,
            branch_email,
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
  const ratingsRes = await client.query(
    `SELECT id,
            branch_id,
            user_id,
            order_id,
            rating_value,
            comment,
            image_url,
            created_at,
            updated_at
     FROM branch_rating
     WHERE branch_id = ANY($1::uuid[])
     ORDER BY created_at DESC`,
    [branchIds],
  );
  const ratingSummaryRes = await client.query(
    `SELECT branch_id,
            avg_rating,
            total_ratings,
            last_updated
     FROM branch_rating_avg
     WHERE branch_id = ANY($1::uuid[])`,
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

  const ratingsMap = ratingsRes.rows.reduce((acc, row) => {
    acc[row.branch_id] = acc[row.branch_id] || [];
    acc[row.branch_id].push(row);
    return acc;
  }, {});

  const ratingSummaryMap = mapRatingSummaryRows(ratingSummaryRes.rows);

  return branches.map((branch) => ({
    id: branch.id,
    restaurantId: branch.restaurant_id,
    branchNumber: branch.branch_number,
    name: branch.name,
    branchPhone: branch.branch_phone,
    branchEmail: branch.branch_email,
    brandPhone: branch.branch_phone,
    brandEmail: branch.branch_email,
    images: branch.images,
    street: branch.street,
    ward: branch.ward,
    district: branch.district,
    city: branch.city,
    latitude: branch.latitude !== null && branch.latitude !== undefined
      ? Number(branch.latitude)
      : null,
    longitude: branch.longitude !== null && branch.longitude !== undefined
      ? Number(branch.longitude)
      : null,
    isPrimary: branch.is_primary,
    ratingSummary: ratingSummaryMap[branch.id] || {
      branchId: branch.id,
      avgRating: branch.rating !== null && branch.rating !== undefined
        ? Number(branch.rating)
        : null,
      totalRatings: (ratingsMap[branch.id] || []).length,
      lastUpdated: null,
    },
    ratings: mapBranchRatings(ratingsMap[branch.id] || []),
    isOpen: branch.is_open,
    rating: branch.rating !== null && branch.rating !== undefined
      ? Number(branch.rating)
      : null,
    createdAt: branch.created_at,
    updatedAt: branch.updated_at,
    openingHours: mapOpeningHours(openingMap[branch.id] || []),
    specialHours: mapSpecialHours(specialMap[branch.id] || []),
  }));
}

async function getAllRestaurants() {
  const { rows } = await pool.query(`${SELECT_RESTAURANT_BASE} ORDER BY created_at DESC`);
  return rows;
}

async function getRestaurantsByOwner(ownerId) {
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

async function getRestaurantById(id, { includeBranches = true } = {}) {
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

async function getRestaurantByOwner(ownerId) {
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

  if (!account) {
    return {
      owner_id: ownerId,
      name: null,
      description: null,
      about: null,
      cuisine: null,
      phone: null,
      email: null,
      logo: null,
      images: null,
      is_active: false,
      restaurant_status: null,
      manager_name: null,
      pending_profile: true,
      branches: [],
      owner: null,
    };
  }

  return {
    owner_id: ownerId,
    name: account.restaurantName || null,
    description: null,
    about: null,
    cuisine: null,
    phone: account.phone || null,
    email: account.email || null,
    logo: null,
    images: null,
    is_active: account.isActive ?? false,
    restaurant_status: account.restaurantStatus || null,
    manager_name: account.managerName || null,
    pending_profile: true,
    branches: [],
    owner,
  };
}

async function createRestaurant(data) {
  const {
    ownerId,
    name,
    description = null,
    about = null,
    cuisine = null,
    phone = null,
    email = null,
    logo = null,
    images = null,
    branches = [],
  } = data;

  if (!ownerId) throw new Error('ownerId is required');
  const trimmedName = sanitiseText(name);
  if (!trimmedName) throw new Error('Restaurant name is required');

  const imageArray = normaliseImages(images);
  const logoArray = normaliseImages(logo);

  const query = `
    INSERT INTO restaurants (owner_id, name, description, about, cuisine, phone, email, logo, images)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const values = [
    ownerId,
    trimmedName,
    sanitiseText(description),
    sanitiseText(about),
    sanitiseText(cuisine),
    sanitiseText(phone),
    sanitiseText(email),
    logoArray,
    imageArray,
  ];

  const { rows } = await pool.query(query, values);
  const restaurantId = rows[0].id;

  if (Array.isArray(branches) && branches.length) {
    try {
      for (const branchPayload of branches) {
        await createRestaurantBranch(restaurantId, branchPayload);
      }
    } catch (error) {
      console.error('[product-service] Failed to create branch during restaurant onboarding:', error.message);
      await pool.query('DELETE FROM restaurants WHERE id = $1', [restaurantId]);
      throw error;
    }
  }

  const restaurant = await getRestaurantById(restaurantId);
  publishSocketEvent('restaurant.created', { restaurantId, restaurant }, roomsForRestaurantEntity(restaurant));
  return restaurant;
}

async function updateRestaurant(id, data) {
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
  if (Object.prototype.hasOwnProperty.call(data, 'about')) {
    fields.push(`about = $${index++}`);
    values.push(sanitiseText(data.about));
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
  if (Object.prototype.hasOwnProperty.call(data, 'logo')) {
    fields.push(`logo = $${index++}`);
    values.push(normaliseImages(data.logo));
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
  const restaurant = await getRestaurantById(rows[0].id);
  if (restaurant) {
    publishSocketEvent(
      'restaurant.updated',
      { restaurantId: restaurant.id, restaurant },
      roomsForRestaurantEntity(restaurant),
    );
  }
  return restaurant;
}

async function deleteRestaurant(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const restaurantRes = await client.query(
      `${SELECT_RESTAURANT_BASE} WHERE id = $1`,
      [id],
    );
    if (!restaurantRes.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const restaurant = restaurantRes.rows[0];

    await client.query('DELETE FROM branch_special_hours WHERE branch_id IN (SELECT id FROM restaurant_branches WHERE restaurant_id = $1)', [id]);
    await client.query('DELETE FROM branch_opening_hours WHERE branch_id IN (SELECT id FROM restaurant_branches WHERE restaurant_id = $1)', [id]);
    await client.query('DELETE FROM branch_rating WHERE branch_id IN (SELECT id FROM restaurant_branches WHERE restaurant_id = $1)', [id]);
    await client.query('DELETE FROM branch_rating_avg WHERE branch_id IN (SELECT id FROM restaurant_branches WHERE restaurant_id = $1)', [id]);
    await client.query('DELETE FROM restaurant_branches WHERE restaurant_id = $1', [id]);
    await client.query('DELETE FROM restaurants WHERE id = $1', [id]);

    await client.query('COMMIT');

    publishSocketEvent(
      'restaurant.deleted',
      { restaurantId: id, ownerId: restaurant.owner_id },
      roomsForRestaurantEntity(restaurant),
    );

    return { message: 'Restaurant deleted successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getBranchesForRestaurant(restaurantId) {
  const client = await pool.connect();
  try {
    return await hydrateBranches(client, restaurantId);
  } finally {
    client.release();
  }
}

async function createRestaurantBranch(restaurantId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const restaurantCheck = await client.query(
      'SELECT id, owner_id FROM restaurants WHERE id = $1',
      [restaurantId],
    );
    if (!restaurantCheck.rowCount) {
      throw new Error('Restaurant not found');
    }
    const restaurantRecord = restaurantCheck.rows[0];

    const branchName = sanitiseText(payload.name);
    if (!branchName) {
      throw new Error('Branch name is required');
    }

    const street = sanitiseText(payload.street);
    const ward = sanitiseText(payload.ward);
    const district = sanitiseText(payload.district);
    const city = sanitiseText(payload.city);

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
    const branchPhoneValue = sanitiseText(
      Object.prototype.hasOwnProperty.call(payload, 'branchPhone')
        ? payload.branchPhone
        : payload.brandPhone,
    );
    const branchEmailValue = sanitiseText(
      Object.prototype.hasOwnProperty.call(payload, 'branchEmail')
        ? payload.branchEmail
        : payload.brandEmail,
    );
    const branchIsOpen = payload.isOpen === true;

    let latitude = parseCoordinate(payload.latitude);
    let longitude = parseCoordinate(payload.longitude);
    if ((latitude === null || longitude === null) && (street || ward || district || city)) {
      const geocoded = await geocodeAddress({ street, ward, district, city });
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }

    const branchInsert = await client.query(
      `INSERT INTO restaurant_branches (
        restaurant_id,
        branch_number,
        name,
        branch_phone,
        branch_email,
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
        branchPhoneValue,
        branchEmailValue,
        branchImages,
        street,
        ward,
        district,
        city,
        latitude,
        longitude,
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
    const resultBranch = branches.find((item) => item.id === branch.id);

    publishSocketEvent(
      'restaurant.branch.created',
      { restaurantId, branch: resultBranch },
      roomsForBranchEntity(restaurantRecord, branch),
    );

    return resultBranch;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateRestaurantBranch(restaurantId, branchId, payload) {
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

    const restaurantRes = await client.query(
      'SELECT id, owner_id FROM restaurants WHERE id = $1',
      [restaurantId],
    );
    const restaurantRecord = restaurantRes.rowCount ? restaurantRes.rows[0] : { id: restaurantId };

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

    const streetValue = Object.prototype.hasOwnProperty.call(payload, 'street')
      ? sanitiseText(payload.street)
      : undefined;
    const wardValue = Object.prototype.hasOwnProperty.call(payload, 'ward')
      ? sanitiseText(payload.ward)
      : undefined;
    const districtValue = Object.prototype.hasOwnProperty.call(payload, 'district')
      ? sanitiseText(payload.district)
      : undefined;
    const cityValue = Object.prototype.hasOwnProperty.call(payload, 'city')
      ? sanitiseText(payload.city)
      : undefined;

    const finalStreet = streetValue !== undefined ? streetValue : existing.street;
    const finalWard = wardValue !== undefined ? wardValue : existing.ward;
    const finalDistrict = districtValue !== undefined ? districtValue : existing.district;
    const finalCity = cityValue !== undefined ? cityValue : existing.city;
    const addressChanged = streetValue !== undefined
      || wardValue !== undefined
      || districtValue !== undefined
      || cityValue !== undefined;

    const hasLatitude = Object.prototype.hasOwnProperty.call(payload, 'latitude');
    const hasLongitude = Object.prototype.hasOwnProperty.call(payload, 'longitude');

    const existingLatitude = existing.latitude !== null && existing.latitude !== undefined
      ? Number.parseFloat(existing.latitude)
      : null;
    const existingLongitude = existing.longitude !== null && existing.longitude !== undefined
      ? Number.parseFloat(existing.longitude)
      : null;

    let latitude = hasLatitude ? parseCoordinate(payload.latitude) : existingLatitude;
    let longitude = hasLongitude ? parseCoordinate(payload.longitude) : existingLongitude;

    if (addressChanged && !hasLatitude && !hasLongitude) {
      if (finalStreet || finalWard || finalDistrict || finalCity) {
        const geocoded = await geocodeAddress({
          street: finalStreet,
          ward: finalWard,
          district: finalDistrict,
          city: finalCity,
        });
        if (geocoded) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
        }
      }
    }

    const branchPhoneInput = Object.prototype.hasOwnProperty.call(payload, 'branchPhone')
      ? payload.branchPhone
      : (Object.prototype.hasOwnProperty.call(payload, 'brandPhone') ? payload.brandPhone : undefined);
    const branchEmailInput = Object.prototype.hasOwnProperty.call(payload, 'branchEmail')
      ? payload.branchEmail
      : (Object.prototype.hasOwnProperty.call(payload, 'brandEmail') ? payload.brandEmail : undefined);

    const updates = [];
    const values = [];
    let index = 1;

    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      updates.push(`name = $${index++}`);
      values.push(sanitiseText(payload.name));
    }
    if (branchPhoneInput !== undefined) {
      updates.push(`branch_phone = $${index++}`);
      values.push(sanitiseText(branchPhoneInput));
    }
    if (branchEmailInput !== undefined) {
      updates.push(`branch_email = $${index++}`);
      values.push(sanitiseText(branchEmailInput));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'images')) {
      updates.push(`images = $${index++}`);
      values.push(normaliseImages(payload.images));
    }
    if (streetValue !== undefined) {
      updates.push(`street = $${index++}`);
      values.push(streetValue);
    }
    if (wardValue !== undefined) {
      updates.push(`ward = $${index++}`);
      values.push(wardValue);
    }
    if (districtValue !== undefined) {
      updates.push(`district = $${index++}`);
      values.push(districtValue);
    }
    if (cityValue !== undefined) {
      updates.push(`city = $${index++}`);
      values.push(cityValue);
    }
    const coordinatesChanged = latitude !== existingLatitude || longitude !== existingLongitude;
    if (hasLatitude || coordinatesChanged) {
      updates.push(`latitude = $${index++}`);
      values.push(latitude ?? null);
    }
    if (hasLongitude || coordinatesChanged) {
      updates.push(`longitude = $${index++}`);
      values.push(longitude ?? null);
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
    const resultBranch = branches.find((item) => item.id === branchId) || null;

    publishSocketEvent(
      'restaurant.branch.updated',
      { restaurantId, branchId, branch: resultBranch },
      roomsForBranchEntity(restaurantRecord, resultBranch || existing),
    );

    return resultBranch;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteRestaurantBranch(restaurantId, branchId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const branchRes = await client.query(
      'SELECT * FROM restaurant_branches WHERE id = $1 AND restaurant_id = $2',
      [branchId, restaurantId],
    );
    if (!branchRes.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const branch = branchRes.rows[0];

    const restaurantRes = await client.query(
      `${SELECT_RESTAURANT_BASE} WHERE id = $1`,
      [restaurantId],
    );
    const restaurant = restaurantRes.rowCount ? restaurantRes.rows[0] : null;

    await client.query('DELETE FROM branch_special_hours WHERE branch_id = $1', [branchId]);
    await client.query('DELETE FROM branch_opening_hours WHERE branch_id = $1', [branchId]);
    await client.query('DELETE FROM branch_rating WHERE branch_id = $1', [branchId]);
    await client.query('DELETE FROM branch_rating_avg WHERE branch_id = $1', [branchId]);
    await client.query('DELETE FROM restaurant_branches WHERE id = $1', [branchId]);

    await client.query('COMMIT');

    publishSocketEvent(
      'restaurant.branch.deleted',
      { restaurantId, branchId },
      roomsForBranchEntity(restaurant, branch),
    );

    return { message: 'Branch deleted successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const model = require('../models/restaurant.model');

async function create(payload){
  return model.createRestaurant(payload);
}

async function list(params = {}){
  return model.listRestaurants(params);
}

async function get(id){
  return model.getRestaurantById(id);
}

async function update(id, payload){
  return model.updateRestaurant(id, payload);
}

async function remove(id){
  return model.deleteRestaurant(id);
}

module.exports = {
  getAllRestaurants,
  getRestaurantsByOwner,
  getRestaurantById,
  getRestaurantByOwner,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getBranchesForRestaurant,
  createRestaurantBranch,
  updateRestaurantBranch,
  deleteRestaurantBranch,
  create,
  list,
  get,
  update,
  remove,
};
