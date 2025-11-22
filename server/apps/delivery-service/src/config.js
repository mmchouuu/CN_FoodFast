const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  env: process.env.NODE_ENV || 'development',
  serviceName: process.env.SERVICE_NAME || 'delivery-service',
  port: number(process.env.PORT || process.env.DELIVERY_SERVICE_PORT, 3002),
  cors: {
    origin: (process.env.CORS_ORIGIN || '*')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  },
  db: {
    host: process.env.DB_HOST || 'deliverydb',
    port: number(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'deliverydb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
    deliveryQueue: process.env.DELIVERY_EVENTS_QUEUE || 'delivery_events',
    orderQueue: process.env.ORDER_EVENTS_QUEUE || 'order_events',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
