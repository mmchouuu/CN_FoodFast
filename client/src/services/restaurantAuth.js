import api from './api';

const basePath = '/api/restaurants';

const restaurantAuth = {
  async register({ restaurantName, companyAddress, taxCode, managerName, phone, email }) {
    const payload = {
      restaurantName,
      companyAddress,
      taxCode,
      managerName,
      phone,
      email,
    };
    const { data } = await api.post(`${basePath}/register`, payload);
    return data;
  },

  async verify({ email, otp, password }) {
    const payload = { email, otp, password };
    const { data } = await api.post(`${basePath}/verify`, payload);
    return data;
  },

  async login({ email, password }) {
    const { data } = await api.post(`${basePath}/login`, { email, password });
    return data;
  },
};

export default restaurantAuth;
