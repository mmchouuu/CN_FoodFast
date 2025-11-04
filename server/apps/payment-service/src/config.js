const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DEFAULT_PORT = 3004;

module.exports = {
  PORT: parseNumber(process.env.PORT, DEFAULT_PORT),
  DB: {
    host: process.env.DB_HOST || 'paymentdb',
    port: parseNumber(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'paymentdb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123',
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true,
          }
        : false,
    max: parseNumber(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parseNumber(process.env.DB_CONNECTION_TIMEOUT_MS, 10000),
  },
  JWT_SECRET: process.env.JWT_SECRET || 'secret',
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
  ORDER_EVENTS_QUEUE: process.env.ORDER_EVENTS_QUEUE || 'order_events',
  PAYMENT_EVENTS_QUEUE: process.env.PAYMENT_EVENTS_QUEUE || 'payment_events',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY || 'VND',
  SETTLEMENT_CRON: process.env.SETTLEMENT_CRON || '0 3 * * *',
};
