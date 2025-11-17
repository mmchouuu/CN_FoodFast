// const { pool } = require('../db');

// const ROLE_PERMISSIONS = {
//   owner_main: {
//     can_manage_branch: true,
//     can_manage_menu: true,
//     can_manage_orders: true,
//     can_manage_finance: true,
//     can_manage_staff: true,
//   },
//   owner: {
//     can_manage_branch: false,
//     can_manage_menu: false,
//     can_manage_orders: true,
//     can_manage_finance: true,
//     can_manage_staff: true,
//   },
//   manager: {
//     can_manage_branch: false,
//     can_manage_menu: false,
//     can_manage_orders: true,
//     can_manage_finance: false,
//     can_manage_staff: true,
//   },
//   staff: {
//     can_manage_branch: false,
//     can_manage_menu: false,
//     can_manage_orders: true,
//     can_manage_finance: false,
//     can_manage_staff: false,
//   },
// };

// function getExecutor(client) {
//   return client || pool;
// }

// function resolvePermissions(role, overrides = {}) {
//   const defaults = ROLE_PERMISSIONS[role] || {};
//   return {
//     can_manage_branch: overrides.can_manage_branch ?? defaults.can_manage_branch ?? false,
//     can_manage_menu: overrides.can_manage_menu ?? defaults.can_manage_menu ?? false,
//     can_manage_orders: overrides.can_manage_orders ?? defaults.can_manage_orders ?? false,
//     can_manage_finance: overrides.can_manage_finance ?? defaults.can_manage_finance ?? false,
//     can_manage_staff: overrides.can_manage_staff ?? defaults.can_manage_staff ?? false,
//   };
// }

// async function createAccount({ restaurantId, loginEmail, displayName, phone, userId }, client) {
//   const executor = getExecutor(client);
//   const result = await executor.query(
//     `
//       INSERT INTO restaurant_accounts (
//         restaurant_id,
//         login_email,
//         display_name,
//         phone,
//         user_id
//       )
//       VALUES ($1, $2, $3, $4, $5)
//       ON CONFLICT (restaurant_id, login_email) DO UPDATE SET
//         display_name = EXCLUDED.display_name,
//         phone = EXCLUDED.phone,
//         user_id = EXCLUDED.user_id,
//         updated_at = now()
//       RETURNING *
//     `,
//     [restaurantId, loginEmail.toLowerCase(), displayName, phone, userId || null],
//   );
//   return result.rows[0];
// }

// async function upsertCredential({ accountId, passwordHash, isTemp = true }, client) {
//   const executor = getExecutor(client);
//   await executor.query(
//     `
//       INSERT INTO restaurant_account_credentials (
//         account_id,
//         password_hash,
//         is_temp
//       )
//       VALUES ($1, $2, $3)
//       ON CONFLICT (account_id)
//       DO UPDATE SET
//         password_hash = EXCLUDED.password_hash,
//         is_temp = EXCLUDED.is_temp,
//         last_changed_at = now()
//     `,
//     [accountId, passwordHash, isTemp],
//   );
// }

// async function assignMembership({
//   accountId,
//   restaurantId,
//   branchId = null,
//   role,
//   permissions = {},
// }, client) {
//   const executor = getExecutor(client);
//   const resolved = resolvePermissions(role, permissions);

//   const result = await executor.query(
//     `
//       INSERT INTO restaurant_account_memberships (
//         account_id,
//         restaurant_id,
//         branch_id,
//         role_in_restaurant,
//         can_manage_branch,
//         can_manage_menu,
//         can_manage_orders,
//         can_manage_finance,
//         can_manage_staff
//       )
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
//       ON CONFLICT (account_id, branch_id)
//       DO UPDATE SET
//         role_in_restaurant = EXCLUDED.role_in_restaurant,
//         can_manage_branch = EXCLUDED.can_manage_branch,
//         can_manage_menu = EXCLUDED.can_manage_menu,
//         can_manage_orders = EXCLUDED.can_manage_orders,
//         can_manage_finance = EXCLUDED.can_manage_finance,
//         can_manage_staff = EXCLUDED.can_manage_staff,
//         updated_at = now()
//       RETURNING *
//     `,
//     [
//       accountId,
//       restaurantId,
//       branchId,
//       role,
//       resolved.can_manage_branch,
//       resolved.can_manage_menu,
//       resolved.can_manage_orders,
//       resolved.can_manage_finance,
//       resolved.can_manage_staff,
//     ],
//   );

//   return result.rows[0];
// }

// module.exports = {
//   ROLE_PERMISSIONS,
//   createAccount,
//   upsertCredential,
//   assignMembership,
// };

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
    can_manage_menu: true,
    can_manage_orders: true,
    can_manage_finance: true,
    can_manage_staff: true,
  },
  manager: {
    can_manage_branch: false,
    can_manage_menu: true,
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

async function findAccountWithMemberships(
  {
    loginEmail,
    restaurantId = null,
    branchId,
  },
  client,
) {
  if (!loginEmail) return null;
  const executor = getExecutor(client);
  const params = [loginEmail.trim().toLowerCase()];
  const conditions = ['LOWER(a.login_email) = $1', 'a.is_active = TRUE', 'ram.is_active = TRUE'];

  if (restaurantId) {
    params.push(restaurantId);
    conditions.push(`ram.restaurant_id = $${params.length}`);
  }

  if (branchId !== undefined) {
    if (branchId === null) {
      conditions.push('ram.branch_id IS NULL');
    } else {
      params.push(branchId);
      conditions.push(`ram.branch_id = $${params.length}`);
    }
  }

  const query = `
    SELECT
      a.id AS account_id,
      a.restaurant_id AS account_restaurant_id,
      a.branch_id AS account_branch_id,
      a.login_email,
      a.display_name,
      a.phone,
      a.user_id,
      a.is_active AS account_active,
      a.created_at AS account_created_at,
      a.updated_at AS account_updated_at,
      cred.id AS credential_id,
      cred.password_hash,
      cred.is_temp,
      cred.last_changed_at,
      ram.id AS membership_id,
      ram.restaurant_id,
      ram.branch_id,
      ram.role_in_restaurant,
      ram.can_manage_branch,
      ram.can_manage_menu,
      ram.can_manage_orders,
      ram.can_manage_finance,
      ram.can_manage_staff,
      ram.is_active AS membership_active,
      ram.created_at AS membership_created_at,
      ram.updated_at AS membership_updated_at
    FROM restaurant_accounts a
    JOIN restaurant_account_credentials cred ON cred.account_id = a.id
    JOIN restaurant_account_memberships ram ON ram.account_id = a.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      ram.role_in_restaurant = 'owner_main' DESC,
      ram.role_in_restaurant = 'owner' DESC,
      ram.created_at DESC
  `;

  const result = await executor.query(query, params);
  if (!result.rowCount) {
    return null;
  }

  const base = result.rows[0];
  const account = {
    id: base.account_id,
    restaurant_id: base.account_restaurant_id,
    branch_id: base.account_branch_id,
    login_email: base.login_email,
    display_name: base.display_name,
    phone: base.phone,
    user_id: base.user_id,
    is_active: base.account_active,
    created_at: base.account_created_at,
    updated_at: base.account_updated_at,
  };
  const credential = {
    id: base.credential_id,
    password_hash: base.password_hash,
    is_temp: base.is_temp,
    last_changed_at: base.last_changed_at,
  };
  const memberships = result.rows.map((row) => ({
    id: row.membership_id,
    restaurant_id: row.restaurant_id,
    branch_id: row.branch_id,
    role: row.role_in_restaurant,
    can_manage_branch: row.can_manage_branch,
    can_manage_menu: row.can_manage_menu,
    can_manage_orders: row.can_manage_orders,
    can_manage_finance: row.can_manage_finance,
    can_manage_staff: row.can_manage_staff,
    is_active: row.membership_active,
    created_at: row.membership_created_at,
    updated_at: row.membership_updated_at,
  }));

  return { account, credential, memberships };
}

async function listAccountsByRestaurant(restaurantId, client) {
  if (!restaurantId) {
    return [];
  }
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT
        a.id AS account_id,
        a.restaurant_id,
        a.branch_id AS account_branch_id,
        a.login_email,
        a.display_name,
        a.phone,
        a.user_id,
        a.is_active AS account_active,
        a.created_at AS account_created_at,
        a.updated_at AS account_updated_at,
        cred.is_temp,
        ram.id AS membership_id,
        ram.branch_id,
        ram.role_in_restaurant,
        ram.can_manage_branch,
        ram.can_manage_menu,
        ram.can_manage_orders,
        ram.can_manage_finance,
        ram.can_manage_staff,
        ram.is_active AS membership_active,
        ram.created_at AS membership_created_at,
        ram.updated_at AS membership_updated_at
      FROM restaurant_accounts a
      JOIN restaurant_account_memberships ram ON ram.account_id = a.id
      LEFT JOIN restaurant_account_credentials cred ON cred.account_id = a.id
      WHERE ram.restaurant_id = $1
      ORDER BY a.created_at DESC, ram.created_at DESC
    `,
    [restaurantId],
  );
  return result.rows;
}

module.exports = {
  ROLE_PERMISSIONS,
  createAccount,
  upsertCredential,
  assignMembership,
  findAccountWithMemberships,
  listAccountsByRestaurant,
};

