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
    socketQueue: process.env.RABBITMQ_SOCKET_QUEUE || 'socket_events',
  },
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
  orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
  serviceAuth: {
    userId:
      process.env.DRONE_SERVICE_USER_ID || '11111111-1111-4111-8111-000000000099',
    role: process.env.DRONE_SERVICE_ROLE || 'drone_operator',
  },
  httpTimeout: number(process.env.HTTP_TIMEOUT_MS, 8000),
  maptiler: {
    key:
      process.env.MAPTILER_KEY ||
      process.env.VITE_MAPTILER_KEY ||
      process.env.MAPTILER_API_KEY ||
      'YUyNgtKuEPD1fLE16S0e',
    geocodeUrl: process.env.MAPTILER_GEOCODE_URL || 'https://api.maptiler.com/geocoding',
    directionsUrl:
      process.env.MAPTILER_DIRECTIONS_URL || 'https://api.maptiler.com/routing/route/v2',
  },
  osrm: {
    baseUrl: process.env.OSRM_BASE_URL || '',
  },
  cacheTtlMs: Number(process.env.ROUTE_CACHE_TTL_MS || 5 * 60 * 1000),
  logLevel: process.env.LOG_LEVEL || 'info',
};
