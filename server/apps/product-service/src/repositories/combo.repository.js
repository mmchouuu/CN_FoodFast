const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

async function createCombo({
  restaurantId,
  name,
  description = null,
  basePrice,
  images = [],
  isActive = true,
  availableFrom = null,
  availableUntil = null,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO combos (
        restaurant_id,
        name,
        description,
        base_price,
        images,
        is_active,
        available_from,
        available_until
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      restaurantId,
      name,
      description,
      basePrice,
      images,
      isActive,
      availableFrom,
      availableUntil,
    ],
  );
  return result.rows[0];
}

async function createComboGroup({
  comboId,
  name,
  minSelect = 1,
  maxSelect = 1,
  required = true,
  displayOrder = null,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO combo_groups (
        combo_id,
        name,
        min_select,
        max_select,
        required,
        display_order
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `,
    [comboId, name, minSelect, maxSelect, required, displayOrder],
  );
  return result.rows[0];
}

async function createComboGroupItem({
  comboGroupId,
  itemType,
  productId = null,
  categoryId = null,
  extraPrice = 0,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO combo_group_items (
        combo_group_id,
        item_type,
        product_id,
        category_id,
        extra_price
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `,
    [comboGroupId, itemType, productId, categoryId, extraPrice],
  );
  return result.rows[0];
}

module.exports = {
  createCombo,
  createComboGroup,
  createComboGroupItem,
};
