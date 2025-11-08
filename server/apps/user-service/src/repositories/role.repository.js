<<<<<<< HEAD
const { pool } = require('../db');

const GLOBAL_ROLES = [
  { code: 'customer', description: 'Customer account' },
  { code: 'owner', description: 'Restaurant owner' },
  { code: 'admin', description: 'Platform administrator' },
];

async function ensureGlobalRoles(client) {
  const executor = client || pool;
  const queryText = `
    INSERT INTO roles (code, description)
    VALUES ($1, $2)
    ON CONFLICT (code) DO UPDATE
      SET description = EXCLUDED.description
  `;
  for (const role of GLOBAL_ROLES) {
    // eslint-disable-next-line no-await-in-loop
    await executor.query(queryText, [role.code, role.description]);
  }
}

async function getRoleByCode(code, client) {
  const executor = client || pool;
  const result = await executor.query('SELECT * FROM roles WHERE code = $1', [code]);
  return result.rows[0] || null;
}

module.exports = {
  ensureGlobalRoles,
  getRoleByCode,
  GLOBAL_ROLES,
};
=======
const { pool } = require('../db');

const GLOBAL_ROLES = [
  { code: 'customer', description: 'Customer account' },
  { code: 'owner', description: 'Restaurant owner' },
  { code: 'admin', description: 'Platform administrator' },
];

async function ensureGlobalRoles(client) {
  const executor = client || pool;
  const queryText = `
    INSERT INTO roles (code, description)
    VALUES ($1, $2)
    ON CONFLICT (code) DO UPDATE
      SET description = EXCLUDED.description
  `;
  for (const role of GLOBAL_ROLES) {
    // eslint-disable-next-line no-await-in-loop
    await executor.query(queryText, [role.code, role.description]);
  }
}

async function getRoleByCode(code, client) {
  const executor = client || pool;
  const result = await executor.query('SELECT * FROM roles WHERE code = $1', [code]);
  return result.rows[0] || null;
}

module.exports = {
  ensureGlobalRoles,
  getRoleByCode,
  GLOBAL_ROLES,
};
>>>>>>> e1903a6c2a79f913b83ae286c7238cad8b947f1d
