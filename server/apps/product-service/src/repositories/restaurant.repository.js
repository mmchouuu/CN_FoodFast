const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

async function createRestaurant({
  ownerUserId,
  name,
  description = null,
  about = null,
  cuisine = null,
  phone = null,
  email = null,
  logo = [],
  images = [],
  isActive = true,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO restaurants (
        owner_user_id,
        name,
        description,
        about,
        cuisine,
        phone,
        email,
        logo,
        images,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      ownerUserId,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      isActive,
    ],
  );
  return result.rows[0];
}

async function nextBranchNumber(restaurantId, executor) {
  const result = await executor.query(
    `
      SELECT COALESCE(MAX(branch_number), 0) + 1 AS next
      FROM restaurant_branches
      WHERE restaurant_id = $1
    `,
    [restaurantId],
  );
  return Number(result.rows[0]?.next || 1);
}

async function createBranch({
  restaurantId,
  branchNumber,
  name = null,
  branchPhone = null,
  branchEmail = null,
  rating = 0,
  images = [],
  street,
  ward = null,
  district = null,
  city = null,
  latitude = null,
  longitude = null,
  isPrimary = false,
  isOpen = false,
}, client) {
  const executor = getExecutor(client);
  const number = branchNumber || (await nextBranchNumber(restaurantId, executor));
  const result = await executor.query(
    `
      INSERT INTO restaurant_branches (
        restaurant_id,
        branch_number,
        name,
        branch_phone,
        branch_email,
        rating,
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `,
    [
      restaurantId,
      number,
      name,
      branchPhone,
      branchEmail,
      rating,
      images,
      street,
      ward,
      district,
      city,
      latitude,
      longitude,
      isPrimary,
      isOpen,
    ],
  );
  return result.rows[0];
}

async function setOpeningHours(branchId, hours = [], client) {
  const executor = getExecutor(client);
  await executor.query('DELETE FROM branch_opening_hours WHERE branch_id = $1', [branchId]);
  if (!Array.isArray(hours) || !hours.length) {
    return [];
  }
  const values = hours.map((item) => [
    branchId,
    item.dayOfWeek,
    item.openTime || null,
    item.closeTime || null,
    item.isClosed === true,
    item.overnight === true,
  ]);
  const inserts = await Promise.all(
    values.map((row) =>
      executor.query(
        `
          INSERT INTO branch_opening_hours (
            branch_id,
            day_of_week,
            open_time,
            close_time,
            is_closed,
            overnight
          )
          VALUES ($1,$2,$3,$4,$5,$6)
          RETURNING *
        `,
        row,
      ),
    ),
  );
  return inserts.map((res) => res.rows[0]);
}

async function setSpecialHours(branchId, specials = [], client) {
  const executor = getExecutor(client);
  await executor.query('DELETE FROM branch_special_hours WHERE branch_id = $1', [branchId]);
  if (!Array.isArray(specials) || !specials.length) {
    return [];
  }
  const values = specials.map((item) => [
    branchId,
    item.onDate,
    item.openTime || null,
    item.closeTime || null,
    item.isClosed === true,
    item.overnight === true,
    item.note || null,
  ]);
  const inserts = await Promise.all(
    values.map((row) =>
      executor.query(
        `
          INSERT INTO branch_special_hours (
            branch_id,
            on_date,
            open_time,
            close_time,
            is_closed,
            overnight,
            note
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING *
        `,
        row,
      ),
    ),
  );
  return inserts.map((res) => res.rows[0]);
}

async function findRestaurantById(id, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM restaurants
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );
  return result.rows[0] || null;
}

async function findRestaurantByOwner(ownerUserId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM restaurants
      WHERE owner_user_id = $1
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [ownerUserId],
  );
  return result.rows[0] || null;
}

async function listRestaurantsByOwner(ownerUserId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM restaurants
      WHERE owner_user_id = $1
      ORDER BY created_at ASC
    `,
    [ownerUserId],
  );
  return result.rows;
}

async function updateRestaurant(id, fields = {}, client) {
  const executor = getExecutor(client);
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return findRestaurantById(id, executor);
  }

  const columns = [];
  const values = [];
  entries.forEach(([key, value]) => {
    let columnName = key;
    switch (key) {
      case 'name':
      case 'description':
      case 'about':
      case 'cuisine':
      case 'phone':
      case 'email':
      case 'logo':
      case 'images':
      case 'is_active':
      case 'isActive':
        columnName =
          key === 'isActive'
            ? 'is_active'
            : key;
        break;
      default:
        columnName = key;
    }
    columns.push(`${columnName} = $${columns.length + 1}`);
    values.push(value);
  });

  if (!columns.length) {
    return findRestaurantById(id, executor);
  }

  values.push(id);
  const result = await executor.query(
    `
      UPDATE restaurants
      SET ${columns.join(', ')}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  );
  return result.rows[0] || null;
}

async function listBranches(restaurantId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM restaurant_branches
      WHERE restaurant_id = $1
      ORDER BY branch_number ASC
    `,
    [restaurantId],
  );
  return result.rows;
}

async function findBranchById(restaurantId, branchId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM restaurant_branches
      WHERE restaurant_id = $1 AND id = $2
      LIMIT 1
    `,
    [restaurantId, branchId],
  );
  return result.rows[0] || null;
}

async function updateBranch(restaurantId, branchId, fields = {}, client) {
  const executor = getExecutor(client);
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return findBranchById(restaurantId, branchId, executor);
  }

  const columns = [];
  const values = [];
  entries.forEach(([key, value]) => {
    let column;
    switch (key) {
      case 'branchNumber':
        column = 'branch_number';
        break;
      case 'branchPhone':
        column = 'branch_phone';
        break;
      case 'branchEmail':
        column = 'branch_email';
        break;
      case 'isPrimary':
        column = 'is_primary';
        break;
      case 'isOpen':
        column = 'is_open';
        break;
      default:
        column = key;
    }
    columns.push(`${column} = $${columns.length + 1}`);
    values.push(value);
  });

  if (!columns.length) {
    return findBranchById(restaurantId, branchId, executor);
  }

  values.push(branchId, restaurantId);
  const result = await executor.query(
    `
      UPDATE restaurant_branches
      SET ${columns.join(', ')}, updated_at = now()
      WHERE id = $${values.length - 1} AND restaurant_id = $${values.length}
      RETURNING *
    `,
    values,
  );
  return result.rows[0] || null;
}

async function deleteBranch(restaurantId, branchId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      DELETE FROM restaurant_branches
      WHERE id = $1 AND restaurant_id = $2
      RETURNING *
    `,
    [branchId, restaurantId],
  );
  return result.rows[0] || null;
}

async function getBranchOpeningHours(branchId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM branch_opening_hours
      WHERE branch_id = $1
      ORDER BY day_of_week ASC
    `,
    [branchId],
  );
  return result.rows;
}

async function getBranchSpecialHours(branchId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM branch_special_hours
      WHERE branch_id = $1
      ORDER BY on_date ASC
    `,
    [branchId],
  );
  return result.rows;
}

async function listAllRestaurants(client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM restaurants
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `,
  );
  return result.rows;
}

module.exports = {
  createRestaurant,
  createBranch,
  setOpeningHours,
  setSpecialHours,
  findRestaurantById,
  findRestaurantByOwner,
  listRestaurantsByOwner,
  updateRestaurant,
  listBranches,
  findBranchById,
  updateBranch,
  deleteBranch,
  getBranchOpeningHours,
  getBranchSpecialHours,
  listAllRestaurants,
};
