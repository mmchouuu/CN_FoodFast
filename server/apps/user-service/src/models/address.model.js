const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.DB);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    street: row.street,
    ward: row.ward,
    district: row.district,
    city: row.city,
    recipient: row.recipient,
    phone: row.phone,
    instructions: row.instructions,
    label: row.label,
    is_primary: row.is_primary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listByUser(userId) {
  const res = await pool.query(
    `SELECT * FROM user_addresses WHERE user_id = $1
     ORDER BY is_primary DESC, updated_at DESC`,
    [userId]
  );
  return res.rows.map(mapRow);
}

async function createAddress(userId, payload = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fields = {
      street: payload.street?.trim(),
      ward: payload.ward?.trim() || null,
      district: payload.district?.trim() || null,
      city: payload.city?.trim() || null,
      label: payload.label?.trim() || 'Home',
      recipient: payload.recipient?.trim() || null,
      phone: payload.phone?.trim() || null,
      instructions: payload.instructions?.trim() || null,
      is_primary: Boolean(payload.is_primary || payload.is_default),
    };

    if (!fields.street) {
      const error = new Error('street is required');
      error.status = 400;
      throw error;
    }

    const existingCountRes = await client.query(
      'SELECT COUNT(*)::int AS count FROM user_addresses WHERE user_id = $1',
      [userId]
    );
    const existingCount = existingCountRes.rows[0]?.count || 0;
    if (existingCount === 0) {
      fields.is_primary = true;
    } else if (fields.is_primary) {
      await client.query(
        'UPDATE user_addresses SET is_primary = false WHERE user_id = $1',
        [userId]
      );
    }

    const insertRes = await client.query(
      `INSERT INTO user_addresses (
        user_id, street, ward, district, city, recipient, phone, instructions,
        is_primary, label
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        userId,
        fields.street,
        fields.ward,
        fields.district,
        fields.city,
        fields.recipient,
        fields.phone,
        fields.instructions,
        fields.is_primary,
        fields.label,
      ]
    );

    await client.query('COMMIT');
    return mapRow(insertRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findById(userId, addressId, client = pool) {
  const res = await client.query(
    'SELECT * FROM user_addresses WHERE id = $1 AND user_id = $2',
    [addressId, userId]
  );
  return mapRow(res.rows[0]);
}

async function updateAddress(userId, addressId, payload = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await findById(userId, addressId, client);
    if (!existing) {
      await client.query('ROLLBACK');
      return null;
    }

    const updates = [];
    const values = [];
    const allowedFields = ['street', 'ward', 'district', 'city', 'recipient', 'phone', 'instructions', 'label'];
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updates.push(`${field} = $${updates.length + 1}`);
        values.push(
          typeof payload[field] === 'string' ? payload[field].trim() : payload[field]
        );
      }
    });

    let setPrimary = null;
    if (Object.prototype.hasOwnProperty.call(payload, 'is_primary') || Object.prototype.hasOwnProperty.call(payload, 'is_default')) {
      setPrimary = Boolean(payload.is_primary || payload.is_default);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = now()`);
      await client.query(
        `UPDATE user_addresses SET ${updates.join(', ')} WHERE id = $${updates.length + 1} AND user_id = $${updates.length + 2}`,
        [...values, addressId, userId]
      );
    }

    if (setPrimary === true) {
      await client.query(
        'UPDATE user_addresses SET is_primary = false WHERE user_id = $1',
        [userId]
      );
      await client.query(
        'UPDATE user_addresses SET is_primary = true, updated_at = now() WHERE id = $1 AND user_id = $2',
        [addressId, userId]
      );
    }

    const updated = await findById(userId, addressId, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteAddress(userId, addressId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await findById(userId, addressId, client);
    if (!existing) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      'DELETE FROM user_addresses WHERE id = $1 AND user_id = $2',
      [addressId, userId]
    );

    if (existing.is_primary) {
      const nextRes = await client.query(
        `SELECT id FROM user_addresses WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [userId]
      );
      const nextAddressId = nextRes.rows[0]?.id;
      if (nextAddressId) {
        await client.query(
          'UPDATE user_addresses SET is_primary = true, updated_at = now() WHERE id = $1',
          [nextAddressId]
        );
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function setPrimary(userId, addressId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await findById(userId, addressId, client);
    if (!existing) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      'UPDATE user_addresses SET is_primary = false WHERE user_id = $1',
      [userId]
    );
    await client.query(
      'UPDATE user_addresses SET is_primary = true, updated_at = now() WHERE id = $1 AND user_id = $2',
      [addressId, userId]
    );
    const updated = await findById(userId, addressId, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listByUser,
  findById,
  createAddress,
  updateAddress,
  deleteAddress,
  setPrimary,
};
