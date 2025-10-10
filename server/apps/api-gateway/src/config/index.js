require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10),
  jwtPublicKey: process.env.JWT_PUBLIC_KEY || 'change_me',
};
