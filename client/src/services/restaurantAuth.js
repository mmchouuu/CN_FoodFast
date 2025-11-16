import api from './api';

const basePath = '/api/restaurants';

const normaliseStatus = (status, emailVerified) => {
  const rawStatus = status || 'pending';
  if (rawStatus === 'approved' && emailVerified) return 'active';
  if (rawStatus === 'approved') return 'approve';
  if (rawStatus === 'rejected') return 'locked';
  return rawStatus;
};

const adaptOwnerLoginResponse = (payload) => {
  if (!payload || payload.user) return payload;
  const owner = payload.owner;
  if (!owner) return payload;
  const profile = owner.profile || {};
  const restaurantStatus = normaliseStatus(profile.status, true);
  return {
    ...payload,
    user: {
      id: owner.id,
      email: owner.email,
      first_name: owner.firstName || owner.first_name || null,
      last_name: owner.lastName || owner.last_name || null,
      phone: owner.phone || null,
      role: 'owner_main',
      manager_name: profile.manager_name || profile.managerName || null,
      restaurant_name: profile.legal_name || profile.legalName || null,
      restaurant_status: restaurantStatus,
      is_active: restaurantStatus === 'active',
      profile,
    },
  };
};

const adaptAccountLoginResponse = (payload) => {
  if (!payload?.account) return payload;
  const account = payload.account;
  const normalizedScope = {
    restaurantIds:
      account.scope?.restaurantIds ||
      account.scope?.restaurant_ids ||
      (account.restaurantId ? [account.restaurantId] : []),
    branchIds:
      account.scope?.branchIds ||
      account.scope?.branch_ids ||
      (account.branchId ? [account.branchId] : []),
  };
  const normalizeMembership = (membership) => ({
    id: membership.id,
    restaurantId: membership.restaurantId || membership.restaurant_id || null,
    branchId: membership.branchId || membership.branch_id || null,
    role: membership.role || membership.role_in_restaurant || null,
    permissions: membership.permissions || {
      canManageBranch: membership.can_manage_branch,
      canManageMenu: membership.can_manage_menu,
      canManageOrders: membership.can_manage_orders,
      canManageFinance: membership.can_manage_finance,
      canManageStaff: membership.can_manage_staff,
    },
    isActive: membership.isActive ?? membership.is_active ?? true,
  });
  return {
    ...payload,
    account: {
      ...account,
      email: account.email || account.login_email,
      displayName: account.displayName || account.display_name || account.email,
      permissions: account.permissions || {
        canManageBranch: account.can_manage_branch,
        canManageMenu: account.can_manage_menu,
        canManageOrders: account.can_manage_orders,
        canManageFinance: account.can_manage_finance,
        canManageStaff: account.can_manage_staff,
      },
      scope: normalizedScope,
      memberships: Array.isArray(account.memberships)
        ? account.memberships.map(normalizeMembership)
        : [],
    },
  };
};

const restaurantAuth = {
  async register({
    firstName,
    lastName,
    restaurantName,
    companyAddress,
    taxCode,
    managerName,
    phone,
    email,
  }) {
    const payload = {
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      legalName: restaurantName?.trim(),
      companyAddress: companyAddress?.trim(),
      taxCode: taxCode?.trim(),
      managerName: managerName?.trim() || undefined,
      phone: phone?.trim() || undefined,
      email: email?.trim(),
    };
    const { data } = await api.post(`${basePath}/signup`, payload);
    return data;
  },

  async verify({ email, otp, activationPassword, newPassword }) {
    const body = {
      email: email?.trim(),
      otp,
      temporaryPassword: activationPassword?.trim() || undefined,
      newPassword: newPassword || undefined,
    };
    const { data } = await api.post(`${basePath}/verify`, body);
    return data;
  },

  async login({ email, password }) {
    const body = {
      email: email?.trim(),
      password,
    };
    const { data } = await api.post(`${basePath}/login`, body);
    return adaptOwnerLoginResponse(data);
  },

  async accountLogin({ email, password, restaurantId, branchId }) {
    const body = {
      email: email?.trim(),
      password,
      restaurantId,
      branchId,
    };
    const { data } = await api.post(`${basePath}/accounts/login`, body);
    return adaptAccountLoginResponse(data);
  },

  async status(email) {
    const cleanEmail = typeof email === 'string' ? email.trim() : email;
    const { data } = await api.get(`${basePath}/status`, { params: { email: cleanEmail } });
    return {
      ...data,
      restaurantStatus: normaliseStatus(data?.status, data?.emailVerified),
    };
  },

  async resendVerification(email) {
    const body = { email: email?.trim() };
    const { data } = await api.post(`${basePath}/resend-verification`, body);
    return data;
  },
};

export default restaurantAuth;
