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

  // async requestPasswordReset(email) {
  //   // Endpoint not yet implemented server-side; mock response for UX consistency
  //   // When available: return (await api.post(`${basePath}/forgot-password`, { email })).data;
  //   return { message: 'If this email exists, a reset link will be sent.' };
  // },
};

export default authService;
