require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10),
  jwtPublicKey: process.env.JWT_PUBLIC_KEY || 'change_me',
};
