module.exports = {
  PORT: process.env.PORT || 3004,
  DB: {
    host: process.env.DB_HOST || 'paymentdb',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paymentdb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123'
  },
  JWT_SECRET: process.env.JWT_SECRET || 'secret'
};
