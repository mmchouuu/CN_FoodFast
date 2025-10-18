import api from "./api";

const basePath = "/api/admin";

const adminService = {
  async getCustomers() {
    const { data } = await api.get(`${basePath}/customers`);
    return data;
  },
  async getRestaurants() {
    const { data } = await api.get(`${basePath}/restaurants`);
    return data;
  },
  async getUserDetails(id) {
    const { data } = await api.get(`${basePath}/users/${id}`);
    return data;
  },
  async updateUserActiveStatus(id, statusPayload) {
    let payload;
    if (typeof statusPayload === "string") {
      payload = { action: statusPayload };
    } else if (typeof statusPayload === "boolean") {
      payload = { is_active: statusPayload };
    } else if (statusPayload && typeof statusPayload === "object") {
      payload = { ...statusPayload };
    } else {
      throw new Error("Invalid status payload");
    }
    const { data } = await api.patch(`${basePath}/users/${id}/active`, payload);
    return data;
  },
  async approveRestaurant(id) {
    const { data } = await api.put(`${basePath}/approve-restaurant/${id}`, {});
    return data;
  },
};

export default adminService;
