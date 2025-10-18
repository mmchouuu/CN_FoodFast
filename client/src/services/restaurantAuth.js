import api from './api';

const basePath = '/api/restaurants';

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
      firstName,
      lastName,
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

  async verify({ email, otp, activationPassword, newPassword }) {
    const payload = { email, otp, activationPassword, newPassword };
    const { data } = await api.post(`${basePath}/verify`, payload);
    return data;
  },

  async login({ email, password }) {
    const { data } = await api.post(`${basePath}/login`, { email, password });
    return data;
  },

  async status(email) {
    const { data } = await api.get(`${basePath}/status`, { params: { email } });
    return data;
  },
};

export default restaurantAuth;
