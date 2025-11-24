// // api-gateway/src/index.js

// require('dotenv').config();
// const fs = require('fs');
// const path = require('path');
// const https = require('https');
// const express = require('express');
// const bodyParser = require('body-parser');
// const config = require('./config');
// const requestId = require('./middlewares/requestId');
// const errorHandler = require('./middlewares/errorHandler');
// const health = require('./health');

// const customersRoutes = require('./routes/customers.routes');
// const restaurantsRoutes = require('./routes/restaurants.routes');
// const adminRoutes = require('./routes/admin.routes');
// const ordersRoutes = require('./routes/orders.routes');
// const paymentsRoutes = require('./routes/payments.routes');
// const customerOrderRoutes = require('./routes/orders.customer.routes');
// const ownerOrderRoutes = require('./routes/orders.owner.routes');
// const adminOrderRoutes = require('./routes/orders.admin.routes');
// const app = express();

// // ======================================================
// // 🔹 Capture raw body BEFORE body-parser consumes it
// // ======================================================
// app.use((req, res, next) => {
//   let chunks = [];
//   req.on('data', chunk => chunks.push(chunk));
//   req.on('end', () => {
//     if (chunks.length > 0) {
//       req.rawBody = Buffer.concat(chunks);
//     }
//   });
//   next();
// });

// // ======================================================
// // 🔹 Parse body (JSON / urlencoded) with verify hook too
// // ======================================================
// app.use(
//   bodyParser.json({
//     limit: '50mb',
//     verify: (req, res, buf) => {
//       if (buf && buf.length && !req.rawBody) req.rawBody = Buffer.from(buf);
//     },
//   })
// );
// app.use(
//   bodyParser.urlencoded({
//     limit: '50mb',
//     extended: true,
//     verify: (req, res, buf) => {
//       if (buf && buf.length && !req.rawBody) req.rawBody = Buffer.from(buf);
//     },
//   })
// );

// // ======================================================
// // 🔹 CORS + RequestID + Routes
// // ======================================================
// app.use((req, res, next) => {
//   const origin = req.headers.origin || '*';
//   res.header('Access-Control-Allow-Origin', origin);
//   res.header('Vary', 'Origin');
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.header(
//     'Access-Control-Allow-Headers',
//     'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-request-id',
//   );
//   res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
//   if (req.method === 'OPTIONS') return res.sendStatus(204);
//   next();
// });
// app.use(requestId);

// app.use('/api/customers', customersRoutes);
// app.use('/api/customer', customersRoutes);
// app.use('/api/restaurants', restaurantsRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/orders', ordersRoutes);
// app.use('/api/payments', paymentsRoutes);
// app.use('/customer/orders', customerOrderRoutes);
// app.use('/owner/orders', ownerOrderRoutes);
// app.use('/admin/orders', adminOrderRoutes);
// app.get('/health', health);
// app.use(errorHandler);


// // ======================================================
// // 🔹 HTTPS startup
// // ======================================================
// const buildHttpsOptions = () => {
//   const { https: httpsConfig } = config;
//   if (!httpsConfig?.enabled) return null;
//   try {
//     const opts = {
//       key: fs.readFileSync(path.resolve(httpsConfig.keyPath)),
//       cert: fs.readFileSync(path.resolve(httpsConfig.certPath)),
//     };
//     if (httpsConfig.caPath) {
//       opts.ca = fs.readFileSync(path.resolve(httpsConfig.caPath));
//     }
//     return opts;
//   } catch (err) {
//     console.error('[api-gateway] Failed to load HTTPS cert/key. Falling back to HTTP.', err.message);
//     return null;
//   }
// };

// const httpsOptions = buildHttpsOptions();
// if (httpsOptions) {
//   https.createServer(httpsOptions, app).listen(config.port, () => {
//     console.log(`API Gateway listening (HTTPS) on port ${config.port}`);
//   });
// } else {
//   app.listen(config.port, () => {
//     console.log(`API Gateway listening on port ${config.port}`);
//   });
// }

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const requestId = require('./middlewares/requestId');
const errorHandler = require('./middlewares/errorHandler');
const health = require('./health');
const customersRoutes = require('./routes/customers.routes');
const restaurantsRoutes = require('./routes/restaurants.routes');
const adminRoutes = require('./routes/admin.routes');
const ordersRoutes = require('./routes/orders.routes');
const paymentsRoutes = require('./routes/payments.routes');
const customerOrderRoutes = require('./routes/orders.customer.routes');
const customerCartRoutes = require('./routes/cart.customer.routes');
const ownerOrderRoutes = require('./routes/orders.owner.routes');
const adminOrderRoutes = require('./routes/orders.admin.routes');
const ownerSettlementsRoutes = require('./routes/settlements.owner.routes');
const ownerRestaurantsRoutes = require('./routes/owner.restaurants.routes');
const ownerDronesRoutes = require('./routes/drones.owner.routes');
const customerDeliveriesRoutes = require('./routes/deliveries.customer.routes');
const mapsRoutes = require('./routes/maps.routes');
const app = express();

// ======================================================
// 🔹 Body parsing (preserve raw body for signature verification)
// ======================================================
const captureRawBody = (req, res, buf) => {
  if (buf && buf.length) {
    req.rawBody = Buffer.from(buf);
  }
};

app.use(
  bodyParser.json({
    limit: '50mb',
    verify: captureRawBody,
  }),
);
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
    verify: captureRawBody,
  }),
);


// ======================================================
// 🔹 CORS + Request ID
// ======================================================

app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-request-id, x-user-id, x-user-role, x-customer-id, x-cart-id'
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(requestId);
app.use('/api/customers', customersRoutes);
app.use('/api/customer', customersRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/customer/orders', customerOrderRoutes);
app.use('/customer/cart', customerCartRoutes);
app.use('/owner/orders', ownerOrderRoutes);
app.use('/owner/settlements', ownerSettlementsRoutes);
app.use('/owner/restaurants', ownerRestaurantsRoutes);
app.use('/owner/drones', ownerDronesRoutes);
app.use('/admin/orders', adminOrderRoutes);
app.use('/api/customer/deliveries', customerDeliveriesRoutes);
app.get('/health', health);
app.use(errorHandler);

// ======================================================
// 🔹 HTTPS Startup
// ======================================================
const buildHttpsOptions = () => {
  const { https: httpsConfig } = config;
  if (!httpsConfig?.enabled) return null;
  try {
    const opts = {
      key: fs.readFileSync(path.resolve(httpsConfig.keyPath)),
      cert: fs.readFileSync(path.resolve(httpsConfig.certPath)),
    };
    if (httpsConfig.caPath) {
      opts.ca = fs.readFileSync(path.resolve(httpsConfig.caPath));
    }
    return opts;
  } catch (err) {
    console.error('[api-gateway] Failed to load HTTPS cert/key. Falling back to HTTP.', err.message);
    return null;
  }
};

const httpsOptions = buildHttpsOptions();
if (httpsOptions) {
  https.createServer(httpsOptions, app).listen(config.port, () => {
    console.log(`API Gateway listening (HTTPS) on port ${config.port}`);
  });
} else {
  app.listen(config.port, () => {
    console.log(`API Gateway listening on port ${config.port}`);
  });
}
