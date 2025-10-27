const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

function adaptAddress(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    street: row.street,
    ward: row.ward,
    district: row.district,
    city: row.city,
    isDefault: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listByUserId(userId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM user_addresses
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId],
  );
  return result.rows.map(adaptAddress);
}

async function createAddress(userId, payload, client) {
  const executor = getExecutor(client);
  const {
    label = null,
    street,
    ward = null,
    district = null,
    city = null,
    isDefault = false,
  } = payload;

  let makeDefault = isDefault === true;
  if (!makeDefault) {
    const existing = await executor.query(
      'SELECT 1 FROM user_addresses WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    if (!existing.rowCount) {
      makeDefault = true;
    }
  }

  if (makeDefault) {
    await executor.query(
      'UPDATE user_addresses SET is_primary = FALSE WHERE user_id = $1',
      [userId],
    );
  }

  const insert = await executor.query(
    `
      INSERT INTO user_addresses (
        user_id,
        label,
        street,
        ward,
        district,
        city,
        is_primary
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `,
    [
      userId,
      label,
      street,
      ward,
      district,
      city,
      makeDefault,
    ],
  );

  return adaptAddress(insert.rows[0]);
}

async function updateAddress(userId, addressId, payload = {}, client) {
  const executor = getExecutor(client);

  const existing = await executor.query(
    `
      SELECT *
      FROM user_addresses
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [addressId, userId],
  );

  if (!existing.rowCount) {
    return null;
  }

  const setDefault = Object.prototype.hasOwnProperty.call(payload, 'isDefault')
    ? Boolean(payload.isDefault)
    : null;

  if (setDefault === true) {
    await executor.query(
      `UPDATE user_addresses SET is_primary = FALSE WHERE user_id = $1 AND id <> $2`,
      [userId, addressId],
    );
  }

  const params = [addressId, userId];
  const sets = [];
  const columnMap = {
    label: 'label',
    street: 'street',
    ward: 'ward',
    district: 'district',
    city: 'city',
  };

  Object.entries(columnMap).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      params.push(payload[key]);
      sets.push(`${column} = $${params.length}`);
    }
  });

  if (setDefault === true) {
    sets.push('is_primary = TRUE');
  } else if (setDefault === false) {
    sets.push('is_primary = FALSE');
  }

  sets.push('updated_at = now()');

  await executor.query(
    `
      UPDATE user_addresses
      SET ${sets.join(', ')}
      WHERE id = $1 AND user_id = $2
    `,
    params,
  );

  if (setDefault === false) {
    const hasDefault = await executor.query(
      `SELECT id FROM user_addresses WHERE user_id = $1 AND is_primary = TRUE LIMIT 1`,
      [userId],
    );

    if (!hasDefault.rowCount) {
      const fallback = await executor.query(
        `
          SELECT id
          FROM user_addresses
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [userId],
      );

      if (fallback.rowCount) {
        await executor.query(
          `UPDATE user_addresses SET is_primary = TRUE WHERE id = $1`,
          [fallback.rows[0].id],
        );
      }
    }
  }

  const refreshed = await executor.query(
    `
      SELECT *
      FROM user_addresses
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [addressId, userId],
  );

  return adaptAddress(refreshed.rows[0]);
}

async function deleteAddress(userId, addressId, client) {
  const executor = getExecutor(client);
  const deleted = await executor.query(
    `
      DELETE FROM user_addresses
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
    [addressId, userId],
  );

  const record = deleted.rows[0];
  if (!record) return null;

  if (record.is_primary) {
    await executor.query(
      `
        WITH next_addr AS (
          SELECT id
          FROM user_addresses
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
        UPDATE user_addresses
        SET is_primary = TRUE
        WHERE id IN (SELECT id FROM next_addr)
      `,
      [userId],
    );
  }

  return adaptAddress(record);
}

module.exports = {
  listByUserId,
  createAddress,
  updateAddress,
  deleteAddress,
};
