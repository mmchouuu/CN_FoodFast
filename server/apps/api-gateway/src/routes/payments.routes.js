// const express = require('express');
// const { createProxyMiddleware } = require('http-proxy-middleware');
// const router = express.Router();
// const jwt = require('jsonwebtoken');

// const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';

// // ===========================
// // 🔹 AUTH MIDDLEWARE
// // ===========================
// function authMiddleware(req, res, next) {
//   if (req.path && req.path.startsWith('/webhook')) {
//     return next(); // Skip auth for Stripe webhooks
//   }

//   // 1️⃣ Cho phép test nhanh qua x-user-id (không cần JWT)
//   const directUserId =
//     req.headers['x-user-id'] ||
//     req.body?.user_id ||
//     req.query?.user_id;

//   if (directUserId) {
//     req.user = {
//       userId: directUserId,
//       role: req.body?.role || 'customer',
//     };
//     return next();
//   }

//   // 2️⃣ Nếu không có x-user-id thì dùng JWT
//   const authHeader = req.headers.authorization;
//   if (!authHeader) return res.status(401).json({ error: 'no token' });

//   const token = authHeader.split(' ')[1];
//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
//     req.user = payload;
//     next();
//   } catch (err) {
//     return res.status(401).json({ error: 'invalid token' });
//   }
// }

// // ===========================
// // 🔹 DEBUG LOG MIDDLEWARE
// // ===========================
// router.use('/', authMiddleware, (req, res, next) => {
//   console.log('--------------------------------------');
//   console.log('[GATEWAY] →', req.method, req.originalUrl);
//   console.log('[GATEWAY] Headers:', req.headers);
//   console.log('[GATEWAY] Body:', req.body);
//   next();
// });

// // ===========================
// // 🔹 PROXY TO PAYMENT-SERVICE
// // ===========================
// router.use(
//   '/',
//   createProxyMiddleware({
//     target: PAYMENT_SERVICE,
//     changeOrigin: true,

//     // Giữ nguyên đường dẫn sau /api/payments/*
//     pathRewrite: (path, req) => {
//       const original = req.originalUrl || path || '';
//       const [pathnameRaw, search = ''] = original.split('?');
//       const pathname = pathnameRaw || '/api/payments';
//       return search ? `${pathname}?${search}` : pathname;
//     },

//     // Re-stream JSON body để tránh request bị treo
//     onProxyReq(proxyReq, req) {
//       const userId = req.user?.userId || req.user?.id || req.user?.sub;
//       if (userId) {
//         proxyReq.setHeader('x-user-id', userId);
//       }

//       const hasBufferedBody = Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0;
//       if (hasBufferedBody) {
//         proxyReq.setHeader('Content-Length', req.rawBody.length);
//         if (req.headers['content-type']) {
//           proxyReq.setHeader('Content-Type', req.headers['content-type']);
//         }
//         proxyReq.write(req.rawBody);
//         proxyReq.end();
//         return;
//       }

//       if (req.body && Object.keys(req.body).length > 0) {
//         const bodyData = JSON.stringify(req.body);
//         proxyReq.setHeader('Content-Type', 'application/json');
//         proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
//         proxyReq.write(bodyData);
//         proxyReq.end();
//       }
//     },



//     // Log lỗi rõ ràng hơn
//     onError: (err, req, res) => {
//       console.error('[Gateway → PaymentService ERROR]', err.message);
//       res.status(502).json({ error: 'bad gateway', detail: err.message });
//     },
//   })
// );

// module.exports = router;

const express = require('express');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');

const router = express.Router();
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';
const paymentServiceUrl = new URL(PAYMENT_SERVICE);
const isPaymentServiceHttps = paymentServiceUrl.protocol === 'https:';

// Detect if PAYMENT_SERVICE already targets /api/payments to avoid double-prefix routes
let targetAlreadyIncludesPaymentsPath = false;
try {
  const normalizedPath = paymentServiceUrl.pathname.replace(/\/$/, '');
  targetAlreadyIncludesPaymentsPath =
    normalizedPath === '/api/payments' || normalizedPath.endsWith('/api/payments');
} catch (err) {
  targetAlreadyIncludesPaymentsPath = /\/api\/payments\/?$/.test(PAYMENT_SERVICE);
}

// ===========================
// 🔹 AUTH MIDDLEWARE
// ===========================
function authMiddleware(req, res, next) {
  // Skip auth for Stripe webhooks
  if (req.path && req.path.startsWith('/webhook')) return next();

  // 1️⃣ Allow x-user-id for quick testing
  const directUserId =
    req.headers['x-user-id'] ||
    req.body?.user_id ||
    req.query?.user_id;

  if (directUserId) {
    req.user = {
      userId: directUserId,
      role: req.body?.role || 'customer',
    };
    return next();
  }

  // 2️⃣ Fallback to JWT
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'no token' });

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// ===========================
// 🔹 DEBUG LOG MIDDLEWARE
// ===========================
router.use('/', authMiddleware, (req, res, next) => {
  console.log('--------------------------------------');
  console.log('[GATEWAY] →', req.method, req.originalUrl);
  console.log('[GATEWAY] Headers:', req.headers);
  console.log('[GATEWAY] Body:', req.body);
  next();
});

// ===========================
// 🔹 PROXY TO PAYMENT-SERVICE
// ===========================
const forwardToPaymentService = (req, res) => {
  const userId = req.user?.userId || req.user?.id || req.user?.sub;
  const headers = { ...req.headers };
  headers.host = paymentServiceUrl.host;
  if (userId) {
    headers['x-user-id'] = userId;
  }

  const rawBody =
    Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0
      ? req.rawBody
      : req.body && Object.keys(req.body).length > 0
        ? Buffer.from(JSON.stringify(req.body))
        : null;

  if (rawBody) {
    headers['content-length'] = rawBody.length;
    if (!headers['content-type']) {
      headers['content-type'] = 'application/json';
    }
  } else {
    delete headers['content-length'];
  }

  const originalPath = req.originalUrl || req.url || '/';
  const suffix = originalPath.replace(/^\/api\/payments/, '') || '/';
  let targetPath = originalPath;
  if (targetAlreadyIncludesPaymentsPath) {
    const basePath = paymentServiceUrl.pathname.replace(/\/$/, '');
    targetPath = `${basePath}${suffix.startsWith('/') ? suffix : `/${suffix}`}` || '/';
  }

  const requestOptions = {
    protocol: paymentServiceUrl.protocol,
    hostname: paymentServiceUrl.hostname,
    port: paymentServiceUrl.port || (isPaymentServiceHttps ? 443 : 80),
    method: req.method,
    path: targetPath,
    headers,
  };

  const transport = isPaymentServiceHttps ? https : http;
  const proxyReq = transport.request(requestOptions, (proxyRes) => {
    res.status(proxyRes.statusCode || 500);
    Object.entries(proxyRes.headers || {}).forEach(([key, value]) => {
      if (typeof value !== 'undefined') {
        res.setHeader(key, value);
      }
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Gateway → PaymentService ERROR]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'bad gateway', detail: err.message });
    } else {
      res.end();
    }
  });

  if (rawBody) {
    proxyReq.write(rawBody);
  }
  proxyReq.end();
};

router.use('/', forwardToPaymentService);

module.exports = router;
