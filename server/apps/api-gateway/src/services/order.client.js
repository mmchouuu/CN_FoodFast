// api-gateway/src/services/order.client.js
const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

// Tạo axios client chuẩn hóa, loại bỏ dấu "/" thừa ở cuối baseURL
const client = createAxiosInstance({
  baseURL: `${(config.orderServiceUrl || 'http://localhost:3003').replace(/\/+$/, '')}/api/orders`,
  timeout: config.requestTimeout,
});

// Hàm tiện ích hợp nhất cách build config
function buildConfig({ headers = {}, params = {} } = {}) {
  const cfg = {};
  if (Object.keys(headers).length > 0) cfg.headers = headers;
  if (Object.keys(params).length > 0) cfg.params = params;
  return cfg;
}

// ----------------------------------------------------------------------
// Lấy danh sách đơn hàng
// ----------------------------------------------------------------------
async function listOrders({ params = {}, headers = {} } = {}) {
  const res = await client.get('/', buildConfig({ headers, params }));
  return res.data;
}

// ----------------------------------------------------------------------
// Lấy chi tiết đơn hàng theo ID
// ----------------------------------------------------------------------
async function getOrderById(orderId, { headers = {} } = {}) {
  const res = await client.get(`/${orderId}`, buildConfig({ headers }));
  return res.data;
}

// ----------------------------------------------------------------------
// Lấy danh sách đơn hàng theo user
// ----------------------------------------------------------------------
async function listOrdersByUser(userId, { headers = {}, params = {} } = {}) {
  const res = await client.get(`/user/${userId}`, buildConfig({ headers, params }));
  return res.data;
}

// ----------------------------------------------------------------------
// Tạo đơn hàng mới
// ----------------------------------------------------------------------
async function createOrder(payload, { headers = {} } = {}) {
  const res = await client.post('/', payload, buildConfig({ headers }));
  return res.data;
}

// ----------------------------------------------------------------------
// Cập nhật trạng thái đơn hàng
// ----------------------------------------------------------------------
async function updateOrderStatus(orderId, status, { headers = {} } = {}) {
  const res = await client.put(`/${orderId}/status`, { status }, buildConfig({ headers }));
  return res.data;
}

// ----------------------------------------------------------------------
// Xác nhận đơn hàng hoàn tất
// ----------------------------------------------------------------------
async function confirmOrder(orderId, payload, { headers = {}, params = {} } = {}) {
  const res = await client.post(
    `/${orderId}/complete`,
    payload,
    buildConfig({ headers, params }),
  );
  return res.data;
}

// ----------------------------------------------------------------------
// Xuất module
// ----------------------------------------------------------------------
module.exports = {
  listOrders,
  getOrderById,
  listOrdersByUser,
  createOrder,
  updateOrderStatus,
  confirmOrder,
};
