require('dotenv').config();

const LAN_HOST = process.env.LAN_IP || '26.62.36.103';
const serviceUrl = (envValue, port) => envValue || `http://${LAN_HOST}:${port}`;

module.exports = {
  port: process.env.PORT || 8080,
  userServiceUrl: serviceUrl(process.env.USER_SERVICE_URL, 3001),
  productServiceUrl: serviceUrl(process.env.PRODUCT_SERVICE_URL, 3002),
  orderServiceUrl: serviceUrl(process.env.ORDER_SERVICE_URL, 3003),
  paymentServiceUrl: serviceUrl(process.env.PAYMENT_SERVICE_URL, 3004),
  deliveryServiceUrl: serviceUrl(process.env.DELIVERY_SERVICE_URL, 3006),
  mapTilerKey: process.env.MAPTILER_KEY || process.env.VITE_MAPTILER_KEY || 'YUyNgtKuEPD1fLE16S0e',
  mapTilerGeocodeUrl:
    process.env.MAPTILER_GEOCODE_URL || 'https://api.maptiler.com/geocoding',
  osrmBaseUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10),
  longRequestTimeout: parseInt(process.env.LONG_REQUEST_TIMEOUT_MS || '30000', 10),
  jwtPublicKey: process.env.JWT_PUBLIC_KEY || 'change_me',
  https: {
    enabled: process.env.GATEWAY_HTTPS_ENABLED === 'true',
    keyPath: process.env.GATEWAY_SSL_KEY_PATH || 'certs/gateway-key.pem',
    certPath: process.env.GATEWAY_SSL_CERT_PATH || 'certs/gateway.pem',
    caPath: process.env.GATEWAY_SSL_CA_PATH || '',
  },
};
