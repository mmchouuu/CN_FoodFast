const OWNER_MAIN_PERMISSIONS = {
  canManageBranch: true,
  canManageMenu: true,
  canManageOrders: true,
  canManageFinance: true,
  canManageStaff: true,
};

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const uniqueStrings = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => (value == null ? null : String(value).trim()))
        .filter((value) => value && value.length),
    ),
  );

const normalisePermissions = (source = {}, role = null) => {
  if (role === 'owner_main') {
    return { ...OWNER_MAIN_PERMISSIONS };
  }
  return {
    canManageBranch: Boolean(
      source.canManageBranch ??
        source.can_manage_branch ??
        source.permissions?.canManageBranch ??
        false,
    ),
    canManageMenu: Boolean(
      source.canManageMenu ??
        source.can_manage_menu ??
        source.permissions?.canManageMenu ??
        false,
    ),
    canManageOrders: Boolean(
      source.canManageOrders ??
        source.can_manage_orders ??
        source.permissions?.canManageOrders ??
        false,
    ),
    canManageFinance: Boolean(
      source.canManageFinance ??
        source.can_manage_finance ??
        source.permissions?.canManageFinance ??
        false,
    ),
    canManageStaff: Boolean(
      source.canManageStaff ??
        source.can_manage_staff ??
        source.permissions?.canManageStaff ??
        false,
    ),
  };
};

const buildScope = (payload = {}) => {
  const rawRestaurantIds =
    payload.restaurantIds ||
    payload.restaurant_ids ||
    ensureArray(payload.restaurantId || payload.restaurant_id);
  const rawBranchIds =
    payload.branchIds ||
    payload.branch_ids ||
    ensureArray(payload.branchId || payload.branch_id);
  return {
    restaurantIds: uniqueStrings(rawRestaurantIds),
    branchIds: uniqueStrings(rawBranchIds),
  };
};

export const buildOwnerSession = (payload = {}) => {
  const owner = payload.owner || payload.user || null;
  if (!owner) return null;
  const token = payload.token || owner.authToken || null;
  const profile = owner.profile || null;
  const firstName = owner.firstName ?? owner.first_name ?? '';
  const lastName = owner.lastName ?? owner.last_name ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || owner.email;
  const managerName =
    profile?.manager_name || profile?.managerName || owner.managerName || owner.manager_name || null;
  const restaurantName =
    profile?.legal_name ||
    profile?.legalName ||
    owner.restaurant_name ||
    owner.restaurantName ||
    null;

  return {
    id: owner.id,
    email: owner.email,
    first_name: firstName || null,
    last_name: lastName || null,
    fullName,
    phone: owner.phone || null,
    managerName,
    restaurantName,
    profile,
    role: 'owner_main',
    sessionType: 'owner_main',
    permissions: { ...OWNER_MAIN_PERMISSIONS },
    scope: buildScope(profile || {}),
    authToken: token,
  };
};

export const buildAccountSession = (payload = {}) => {
  const account = payload.account || null;
  if (!account) return null;
  const token = payload.token || account.authToken || null;
  const role = account.role || 'staff';
  const displayName =
    account.displayName || account.display_name || account.fullName || account.email || '';
  const scopeSource = account.scope || {};
  const scope = {
    restaurantIds: uniqueStrings(
      scopeSource.restaurantIds ||
        scopeSource.restaurant_ids ||
        ensureArray(account.restaurantId || account.restaurant_id),
    ),
    branchIds: uniqueStrings(
      scopeSource.branchIds ||
        scopeSource.branch_ids ||
        ensureArray(account.branchId || account.branch_id),
    ),
  };

  return {
    id: account.id,
    email: account.email || account.login_email,
    phone: account.phone || null,
    fullName: displayName,
    displayName,
    role,
    sessionType: role === 'owner_main' ? 'owner_main' : role,
    branchId: account.branchId || account.branch_id || null,
    restaurantId: account.restaurantId || account.restaurant_id || null,
    permissions: normalisePermissions(account.permissions || account, role),
    scope,
    memberships: Array.isArray(account.memberships) ? account.memberships : [],
    authToken: token,
    requiresPasswordReset: Boolean(account.requiresPasswordReset),
  };
};

export const buildRestaurantSession = (payload = {}) =>
  buildAccountSession(payload) || buildOwnerSession(payload);

export { OWNER_MAIN_PERMISSIONS, normalisePermissions };
