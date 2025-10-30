const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

async function findByEmail(email, client) {
  if (!email) return null;
  const executor = getExecutor(client);
  const normalized = email.trim().toLowerCase();
  const result = await executor.query(
    `
      SELECT u.*
      FROM users u
      WHERE LOWER(u.email) = $1
      LIMIT 1
    `,
    [normalized],
  );
  return result.rows[0] || null;
}

async function findById(id, client) {
  if (!id) return null;
  const executor = getExecutor(client);
  const result = await executor.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createUser(payload, client) {
  const executor = getExecutor(client);
  const {
    email,
    firstName = null,
    lastName = null,
    phone = null,
    isActive = true,
    emailVerified = false,
  } = payload;

  const result = await executor.query(
    `
      INSERT INTO users (
        email,
        first_name,
        last_name,
        phone,
        is_active,
        email_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      email.trim().toLowerCase(),
      firstName,
      lastName,
      phone,
      isActive,
      emailVerified,
    ],
  );

  return result.rows[0];
}

async function updateUser(id, fields, client) {
  const executor = getExecutor(client);
  const entries = Object.entries(fields || {});
  if (!entries.length) {
    return findById(id, executor);
  }

  const columns = [];
  const values = [];
  entries.forEach(([key, value]) => {
    switch (key) {
      case 'firstName':
        columns.push(`first_name = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'lastName':
        columns.push(`last_name = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'phone':
        columns.push(`phone = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'emailVerified':
        columns.push(`email_verified = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'isActive':
        columns.push(`is_active = $${columns.length + 1}`);
        values.push(value);
        break;
      default:
        columns.push(`${key} = $${columns.length + 1}`);
        values.push(value);
    }
  });

  if (!columns.length) {
    return findById(id, executor);
  }

  values.push(id);
  const result = await executor.query(
    `
      UPDATE users
      SET ${columns.join(', ')}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  );

  return result.rows[0];
}

async function assignRole(userId, roleId, client) {
  const executor = getExecutor(client);
  await executor.query(
    `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [userId, roleId],
  );
}

async function getRoleAssignments(userId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT ur.role_id, r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
    `,
    [userId],
  );
  return result.rows;
}

async function getUserRoleCodes(userId, client) {
  const rows = await getRoleAssignments(userId, client);
  return rows.map((row) => row.code);
}

async function upsertCredential({ userId, roleId, passwordHash, isTemp = false }, client) {
  const executor = getExecutor(client);
  await executor.query(
    `
      INSERT INTO user_credentials (
        user_id,
        role_id,
        password_hash,
        is_temp
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, role_id)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        is_temp = EXCLUDED.is_temp,
        last_changed_at = now()
    `,
    [userId, roleId, passwordHash, isTemp],
  );
}

async function getCredential(userId, roleId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM user_credentials
      WHERE user_id = $1 AND role_id = $2
      LIMIT 1
    `,
    [userId, roleId],
  );
  return result.rows[0] || null;
}

async function createCustomerProfile(userId, client) {
  const executor = getExecutor(client);
  await executor.query(
    `
      INSERT INTO customer_profiles (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );
}

async function getCustomerProfile(userId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM customer_profiles
      WHERE user_id = $1
    `,
    [userId],
  );
  return result.rows[0] || null;
}

async function createOwnerProfile({
  userId,
  legalName,
  taxCode,
  companyAddress,
  managerName,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO owner_profiles (
        user_id,
        legal_name,
        tax_code,
        company_address,
        manager_name,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      ON CONFLICT (user_id) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        tax_code = EXCLUDED.tax_code,
        company_address = EXCLUDED.company_address,
        manager_name = EXCLUDED.manager_name,
        updated_at = now()
      RETURNING *
    `,
    [userId, legalName, taxCode, companyAddress, managerName],
  );
  return result.rows[0];
}

async function updateOwnerProfile(userId, fields, client) {
  const executor = getExecutor(client);
  const entries = Object.entries(fields || {});
  if (!entries.length) {
    return null;
  }

  const columns = [];
  const values = [];
  entries.forEach(([key, value]) => {
    switch (key) {
      case 'legalName':
        columns.push(`legal_name = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'taxCode':
        columns.push(`tax_code = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'companyAddress':
        columns.push(`company_address = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'managerName':
        columns.push(`manager_name = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'status':
        columns.push(`status = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'approvedBy':
        columns.push(`approved_by = $${columns.length + 1}`);
        values.push(value);
        break;
      case 'approvedAt':
        columns.push(`approved_at = $${columns.length + 1}`);
        values.push(value);
        break;
      default:
        break;
    }
  });

  if (!columns.length) {
    return null;
  }

  values.push(userId);
  const result = await executor.query(
    `
      UPDATE owner_profiles
      SET ${columns.join(', ')}, updated_at = now()
      WHERE user_id = $${values.length}
      RETURNING *
    `,
    values,
  );
  return result.rows[0] || null;
}

async function getOwnerProfileByUserId(userId, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM owner_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return result.rows[0] || null;
}

async function listCustomers({ limit = 50, offset = 0 } = {}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.is_active,
        u.email_verified,
        cp.tier,
        cp.loyalty_points,
        cp.total_spent,
        cp.updated_at AS profile_updated_at
      FROM users u
      JOIN customer_profiles cp ON cp.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );
  return result.rows;
}

async function setCustomerActiveStatus(userId, isActive, client) {
  const executor = getExecutor(client);
  await executor.query(
    `
      UPDATE users
      SET is_active = $2, updated_at = now()
      WHERE id = $1
    `,
    [userId, isActive],
  );
}

async function listOwnerProfiles({ status, limit = 50, offset = 0 } = {}, client) {
  const executor = getExecutor(client);
  const conditions = [];
  const params = [limit, offset];
  if (status) {
    conditions.push(`op.status = $${params.length + 2}`);
    params.push(status);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.email_verified,
      op.legal_name,
      op.tax_code,
      op.company_address,
      op.manager_name,
      op.status,
      op.approved_at,
      op.approved_by,
      op.created_at
    FROM owner_profiles op
    JOIN users u ON u.id = op.user_id
    ${whereClause}
    ORDER BY op.created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const result = await executor.query(query, params);
  return result.rows;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateUser,
  assignRole,
  getRoleAssignments,
  getUserRoleCodes,
  upsertCredential,
  getCredential,
  createCustomerProfile,
  getCustomerProfile,
  createOwnerProfile,
  updateOwnerProfile,
  getOwnerProfileByUserId,
  listCustomers,
  setCustomerActiveStatus,
  listOwnerProfiles,
};
