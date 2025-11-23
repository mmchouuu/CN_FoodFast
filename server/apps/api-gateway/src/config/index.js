require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
  deliveryServiceUrl: process.env.DELIVERY_SERVICE_URL || 'http://localhost:3006',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10),
  jwtPublicKey: process.env.JWT_PUBLIC_KEY || 'change_me',
  https: {
    enabled: process.env.GATEWAY_HTTPS_ENABLED === 'true',
    keyPath: process.env.GATEWAY_SSL_KEY_PATH || 'certs/gateway-key.pem',
    certPath: process.env.GATEWAY_SSL_CERT_PATH || 'certs/gateway.pem',
    caPath: process.env.GATEWAY_SSL_CA_PATH || '',
  },
};
