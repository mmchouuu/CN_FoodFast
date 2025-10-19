import api from './api';

const basePath = '/api/customers';

export const authService = {
  async login(email, password) {
    const { data } = await api.post(`${basePath}/login`, { email, password });
    return data;
  },

  async register({ firstName, lastName, email, password, phone }) {
    const payload = {
      first_name: firstName,
      last_name: lastName,
      email,
      password,
      phone,
    };
    const { data } = await api.post(`${basePath}/register`, payload);
    return data;
  },

  async verify(email, otp) {
    const { data } = await api.post(`${basePath}/verify`, { email, otp });
    return data;
  },

  async requestPasswordReset(email) {
    try {
      const { data } = await api.post(`${basePath}/forgot-password`, { email });
      return data;
    } catch (error) {
      if (error?.response?.status === 404 || error?.response?.status === 501) {
        return { message: 'If this email exists, a reset link will be sent.' };
      }
      throw error;
    }
  },
};

export default authService;
