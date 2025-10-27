import api from './api';

const basePath = '/api/customers';

const withUserOverride = (config = {}, userId) => {
  if (!userId) return { ...config };
  return {
    ...config,
    params: { ...(config.params || {}), user_id: userId },
  };
};

const unwrapItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const authService = {
  async login(email, password) {
    const body = {
      email: typeof email === 'string' ? email.trim() : email,
      password,
    };
    const { data } = await api.post(`${basePath}/login`, body);
    return data;
  },

  async register({ firstName, lastName, email, password, phone }) {
    const payload = {
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      email: email?.trim(),
      password,
      phone: phone?.trim() || undefined,
    };
    const { data } = await api.post(`${basePath}/signup`, payload);
    return data;
  },

  async verify(email, otp) {
    const body = {
      email: typeof email === 'string' ? email.trim() : email,
      otp,
    };
    const { data } = await api.post(`${basePath}/verify`, body);
    return data;
  },

  async requestPasswordReset(email) {
    const body = { email: typeof email === 'string' ? email.trim() : email };
    const { data } = await api.post(`${basePath}/forgot-password`, body);
    return data;
  },

  async resetPassword({ email, otp, newPassword }) {
    const body = {
      email: typeof email === 'string' ? email.trim() : email,
      otp,
      newPassword,
    };
    const { data } = await api.post(`${basePath}/reset-password`, body);
    return data;
  },

  async listAddresses({ userId } = {}) {
    const config = withUserOverride({}, userId);
    const { data } = await api.get(`${basePath}/addresses`, config);
    return unwrapItems(data);
  },

  async createAddress(payload) {
    const userId = payload?.user_id;
    const config = withUserOverride({}, userId);
    const { data } = await api.post(`${basePath}/addresses`, payload, config);
    return data;
  },

  async updateAddress(addressId, payload) {
    const userId = payload?.user_id;
    const config = withUserOverride({}, userId);
    const { data } = await api.put(`${basePath}/addresses/${addressId}`, payload, config);
    return data;
  },

  async deleteAddress(addressId, { userId } = {}) {
    const config = withUserOverride({}, userId);
    await api.delete(`${basePath}/addresses/${addressId}`, config);
    return true;
  },
};

export default authService;
