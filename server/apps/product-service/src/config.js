module.exports = {
  port: Number(process.env.PORT || process.env.PRODUCT_SERVICE_PORT || 3002),
  db: {
    host: process.env.DB_HOST || 'productdb',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'productdb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123',
  },
  userService: {
    baseUrl: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    timeoutMs: Number(process.env.USER_SERVICE_TIMEOUT || 5000),
  },
};
