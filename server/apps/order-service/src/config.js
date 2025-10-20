const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DB_HOST = process.env.DB_HOST || 'orderdb';
const DB_PORT = parseNumber(process.env.DB_PORT, 5432);
const DB_NAME = process.env.DB_NAME || 'orderdb';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '123';

module.exports = {
  PORT: parseNumber(process.env.PORT, 3003),
  JWT_SECRET: process.env.JWT_SECRET || 'secret',
  DB: {
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
    max: parseNumber(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parseNumber(process.env.DB_CONNECTION_TIMEOUT_MS, 10000),
  },
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
  ORDER_EVENTS_QUEUE: process.env.ORDER_EVENTS_QUEUE || 'order_events',
};
