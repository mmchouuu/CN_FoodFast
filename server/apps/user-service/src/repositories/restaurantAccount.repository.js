const { pool } = require('../db');

const ROLE_PERMISSIONS = {
  owner_main: {
    can_manage_branch: true,
    can_manage_menu: true,
    can_manage_orders: true,
    can_manage_finance: true,
    can_manage_staff: true,
  },
  owner: {
    can_manage_branch: false,
    can_manage_menu: false,
    can_manage_orders: true,
    can_manage_finance: true,
    can_manage_staff: true,
  },
  manager: {
    can_manage_branch: false,
    can_manage_menu: false,
    can_manage_orders: true,
    can_manage_finance: false,
    can_manage_staff: true,
  },
  staff: {
    can_manage_branch: false,
    can_manage_menu: false,
    can_manage_orders: true,
    can_manage_finance: false,
    can_manage_staff: false,
  },
};

function getExecutor(client) {
  return client || pool;
}

function resolvePermissions(role, overrides = {}) {
  const defaults = ROLE_PERMISSIONS[role] || {};
  return {
    can_manage_branch: overrides.can_manage_branch ?? defaults.can_manage_branch ?? false,
    can_manage_menu: overrides.can_manage_menu ?? defaults.can_manage_menu ?? false,
    can_manage_orders: overrides.can_manage_orders ?? defaults.can_manage_orders ?? false,
    can_manage_finance: overrides.can_manage_finance ?? defaults.can_manage_finance ?? false,
    can_manage_staff: overrides.can_manage_staff ?? defaults.can_manage_staff ?? false,
  };
}

async function createAccount({ restaurantId, loginEmail, displayName, phone, userId }, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO restaurant_accounts (
        restaurant_id,
        login_email,
        display_name,
        phone,
        user_id
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (restaurant_id, login_email) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        phone = EXCLUDED.phone,
        user_id = EXCLUDED.user_id,
        updated_at = now()
      RETURNING *
    `,
    [restaurantId, loginEmail.toLowerCase(), displayName, phone, userId || null],
  );
  return result.rows[0];
}

async function upsertCredential({ accountId, passwordHash, isTemp = true }, client) {
  const executor = getExecutor(client);
  await executor.query(
    `
      INSERT INTO restaurant_account_credentials (
        account_id,
        password_hash,
        is_temp
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (account_id)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        is_temp = EXCLUDED.is_temp,
        last_changed_at = now()
    `,
    [accountId, passwordHash, isTemp],
  );
}

async function assignMembership({
  accountId,
  restaurantId,
  branchId = null,
  role,
  permissions = {},
}, client) {
  const executor = getExecutor(client);
  const resolved = resolvePermissions(role, permissions);

  const result = await executor.query(
    `
      INSERT INTO restaurant_account_memberships (
        account_id,
        restaurant_id,
        branch_id,
        role_in_restaurant,
        can_manage_branch,
        can_manage_menu,
        can_manage_orders,
        can_manage_finance,
        can_manage_staff
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (account_id, branch_id)
      DO UPDATE SET
        role_in_restaurant = EXCLUDED.role_in_restaurant,
        can_manage_branch = EXCLUDED.can_manage_branch,
        can_manage_menu = EXCLUDED.can_manage_menu,
        can_manage_orders = EXCLUDED.can_manage_orders,
        can_manage_finance = EXCLUDED.can_manage_finance,
        can_manage_staff = EXCLUDED.can_manage_staff,
        updated_at = now()
      RETURNING *
    `,
    [
      accountId,
      restaurantId,
      branchId,
      role,
      resolved.can_manage_branch,
      resolved.can_manage_menu,
      resolved.can_manage_orders,
      resolved.can_manage_finance,
      resolved.can_manage_staff,
    ],
  );

  return result.rows[0];
}

module.exports = {
  ROLE_PERMISSIONS,
  createAccount,
  upsertCredential,
  assignMembership,
};
