// const express = require('express');
// const { createProxyMiddleware } = require('http-proxy-middleware');
// const forwardProxyBody = require('../utils/forwardProxyBody');

// const router = express.Router();

// const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

// // Tạo proxy chuẩn
// const CUSTOMER_ORDERS_PREFIX = '/customer/orders';

// const rewriteToCustomerOrders = (path = '') => {
//   if (typeof path !== 'string' || !path.length) {
//     return CUSTOMER_ORDERS_PREFIX;
//   }

//   if (path.startsWith(CUSTOMER_ORDERS_PREFIX)) {
//     return path.replace(/\/{2,}/g, '/');
//   }

//   const normalized = path
//     .replace(/^\/api\/orders\/customer\/orders/, CUSTOMER_ORDERS_PREFIX)
//     .replace(/^\/api\/orders\/customer/, CUSTOMER_ORDERS_PREFIX)
//     .replace(/\/{2,}/g, '/');

//   if (normalized.startsWith(CUSTOMER_ORDERS_PREFIX)) {
//     return normalized;
//   }

//   const suffix = normalized.startsWith('/') ? normalized : `/${normalized}`;
//   return `${CUSTOMER_ORDERS_PREFIX}${suffix}`.replace(/\/{2,}/g, '/');
// };

// const buildCustomerOrdersProxy = () =>
//   createProxyMiddleware({
//     target: ORDER_SERVICE_URL,
//     changeOrigin: true,

//     // 🔥 Đảm bảo mọi request luôn đi vào `/customer/orders/...` tại order-service
//     pathRewrite: (path) => rewriteToCustomerOrders(path),

//     onProxyReq: (proxyReq, req) => {
//       if (req.customerIdentity?.userId) {
//         proxyReq.setHeader('x-user-id', req.customerIdentity.userId);
//         proxyReq.setHeader('x-user-role', 'customer');
//       }
//       forwardProxyBody(proxyReq, req);
//     },

//     onError: (err, req, res) => {
//       if (res.headersSent) return;
//       res.status(502).json({
//         error: 'order-service unavailable',
//         detail: err.message,
//       });
//     },
//   });

// const customerOrdersProxy = buildCustomerOrdersProxy();

// // Xác thực user
// const ensureCustomerIdentity = (req, res, next) => {
//   const authHeader = req.headers.authorization || '';

//   const candidate =
//     req.headers['x-customer-id'] ||
//     req.headers['x-user-id'] ||
//     req.query?.customerId ||
//     req.query?.customer_id ||
//     req.query?.userId ||
//     req.query?.user_id ||
//     req.body?.customerId ||
//     req.body?.customer_id ||
//     req.body?.userId ||
//     req.body?.user_id;

//   if (candidate) {
//     req.customerIdentity = {
//       userId: String(candidate).trim(),
//       role: 'customer',
//     };
//     return next();
//   }

//   if (authHeader.startsWith('Bearer ')) {
//     return next();
//   }

//   return res.status(401).json({ error: 'customer identity required' });
// };

// // Áp dụng route
// router.post('/', ensureCustomerIdentity, customerOrdersProxy);
// router.get('/', ensureCustomerIdentity, customerOrdersProxy);
// router.get('/:id', ensureCustomerIdentity, customerOrdersProxy);
// router.post('/:id/cancel', ensureCustomerIdentity, customerOrdersProxy);
// router.post('/:id/complete', ensureCustomerIdentity, customerOrdersProxy);
// router.patch('/:id/status', ensureCustomerIdentity, customerOrdersProxy);
// router.put('/:id/status', ensureCustomerIdentity, customerOrdersProxy);

// module.exports = router;

// ----------------------------------------------------------------------------------

// const express = require("express");
// const { createProxyMiddleware } = require("http-proxy-middleware");
// const forwardProxyBody = require("../utils/forwardProxyBody");

// const router = express.Router();

// const ORDER_SERVICE_URL =
//   process.env.ORDER_SERVICE_URL || "http://order-service:3003";

// // const CUSTOMER_PREFIX = "/customer/orders";

// // const buildProxyPath = (req) => {
// //   const suffix = typeof req.url === "string" ? req.url : "";
// //   return `${CUSTOMER_PREFIX}${suffix}`.replace(/\/{2,}/g, "/");
// // };

// // const CUSTOMER_PREFIX = "/customer/orders";

// // const buildProxyPath = (path = "") => {
// //   if (typeof path !== "string" || !path.length || path === "/") {
// //     return CUSTOMER_PREFIX;
// //   }

// //   const sanitizedPath = path.replace(/\/{2,}/g, "/");
// //   if (sanitizedPath.startsWith(CUSTOMER_PREFIX)) {
// //     return sanitizedPath;
// //   }

// //   const normalized = sanitizedPath
// //     .replace(/^\/api\/orders\/customer\/orders/, CUSTOMER_PREFIX)
// //     .replace(/^\/api\/orders\/customer/, CUSTOMER_PREFIX)
// //     .replace(/^\/api\/orders/, "");

// //   if (normalized.startsWith(CUSTOMER_PREFIX)) {
// //     return normalized.replace(/\/{2,}/g, "/");
// //   }

// //   const suffix = normalized.startsWith("/") ? normalized : `/${normalized}`;
// //   return `${CUSTOMER_PREFIX}${suffix}`.replace(/\/{2,}/g, "/");
// // };

// // const customerOrdersProxy = createProxyMiddleware({
// //   target: ORDER_SERVICE_URL,
// //   changeOrigin: true,

// //   pathRewrite: (path) => buildProxyPath(path),

// //   onProxyReq: (proxyReq, req) => {
// //     if (req.customerIdentity?.userId) {
// //       proxyReq.setHeader("x-user-id", req.customerIdentity.userId);
// //       proxyReq.setHeader("x-user-role", "customer");
// //     }
// //     forwardProxyBody(proxyReq, req);
// //   },

// //   onError: (err, req, res) => {
// //     if (!res.headersSent) {
// //       res.status(502).json({
// //         error: "order-service unavailable",
// //         detail: err.message,
// //       });
// //     }
// //   },
// // });

// const CUSTOMER_PREFIX = "/customer/orders";

// const buildProxyPath = (req) => {
//   // Lấy đúng phần sau /customer/orders
//   const suffix = req.url || "";
//   return `${CUSTOMER_PREFIX}${suffix}`.replace(/\/{2,}/g, "/");
// };

// const customerOrdersProxy = createProxyMiddleware({
//   target: ORDER_SERVICE_URL,
//   changeOrigin: true,

//   pathRewrite: (path, req) => buildProxyPath(req),

//   onProxyReq: (proxyReq, req) => {
//     if (req.customerIdentity?.userId) {
//       proxyReq.setHeader("x-user-id", req.customerIdentity.userId);
//       proxyReq.setHeader("x-user-role", "customer");
//     }
//     forwardProxyBody(proxyReq, req);
//   }
// });



// // Identity middleware
// const ensureCustomerIdentity = (req, res, next) => {
//   const authHeader = req.headers.authorization || "";

//   const candidate =
//     req.headers["x-customer-id"] ||
//     req.headers["x-user-id"] ||
//     req.query?.customerId ||
//     req.query?.customer_id ||
//     req.query?.userId ||
//     req.query?.user_id ||
//     req.body?.customerId ||
//     req.body?.customer_id ||
//     req.body?.userId ||
//     req.body?.user_id;

//   if (candidate) {
//     req.customerIdentity = {
//       userId: String(candidate).trim(),
//       role: "customer",
//     };
//     return next();
//   }

//   if (authHeader.startsWith("Bearer ")) {
//     return next();
//   }

//   return res.status(401).json({ error: "customer identity required" });
// };

// // Routes
// router.post("/", ensureCustomerIdentity, customerOrdersProxy);
// router.get("/", ensureCustomerIdentity, customerOrdersProxy);
// router.get("/:id", ensureCustomerIdentity, customerOrdersProxy);
// router.post("/:id/cancel", ensureCustomerIdentity, customerOrdersProxy);
// router.post("/:id/complete", ensureCustomerIdentity, customerOrdersProxy);
// router.patch("/:id/status", ensureCustomerIdentity, customerOrdersProxy);
// router.put("/:id/status", ensureCustomerIdentity, customerOrdersProxy);

// module.exports = router;
// ---------------------------------------------------------------------

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const forwardProxyBody = require("../utils/forwardProxyBody");

const router = express.Router();

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:3003";

const customerOrdersProxy = createProxyMiddleware({
  target: ORDER_SERVICE_URL,
  changeOrigin: true,

  pathRewrite: {
    "^/customer/orders": ""
  },

  onProxyReq: (proxyReq, req) => {
    if (req.customerIdentity?.userId) {
      proxyReq.setHeader("x-user-id", req.customerIdentity.userId);
      proxyReq.setHeader("x-user-role", "customer");
    }
    forwardProxyBody(proxyReq, req);
  }
});


// Identity middleware
const ensureCustomerIdentity = (req, res, next) => {
  const authHeader = req.headers.authorization || "";

  const candidate =
    req.headers["x-customer-id"] ||
    req.headers["x-user-id"] ||
    req.query?.customerId ||
    req.query?.customer_id ||
    req.query?.userId ||
    req.query?.user_id ||
    req.body?.customerId ||
    req.body?.customer_id ||
    req.body?.userId ||
    req.body?.user_id;

  if (candidate) {
    req.customerIdentity = {
      userId: String(candidate).trim(),
      role: "customer",
    };
    return next();
  }

  if (authHeader.startsWith("Bearer ")) {
    return next();
  }

  return res.status(401).json({ error: "customer identity required" });
};

// Routes
router.post("/", ensureCustomerIdentity, customerOrdersProxy);
router.get("/", ensureCustomerIdentity, customerOrdersProxy);
router.get("/:id", ensureCustomerIdentity, customerOrdersProxy);
router.post("/:id/cancel", ensureCustomerIdentity, customerOrdersProxy);
router.post("/:id/complete", ensureCustomerIdentity, customerOrdersProxy);
router.patch("/:id/status", ensureCustomerIdentity, customerOrdersProxy);
router.put("/:id/status", ensureCustomerIdentity, customerOrdersProxy);

module.exports = router;
