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
      role: 'owner',
      manager_name: profile.manager_name || profile.managerName || null,
      restaurant_name: profile.legal_name || profile.legalName || null,
      restaurant_status: restaurantStatus,
      is_active: restaurantStatus === 'active',
      profile,
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
