// require('dotenv').config();
// const express = require('express');
// const { createProxyMiddleware } = require('http-proxy-middleware');
// const jwt = require('jsonwebtoken');

// const app = express();

// // ===== Health check Gateway =====
// app.get('/health', (req, res) => {
//   res.json({ status: "ok", service: "api-gateway" });
// });

// // ===== Middleware verify JWT =====
// function authMiddleware(req, res, next) {
//   const token = req.headers['authorization']?.split(' ')[1];
//   if (!token) return res.status(401).json({ error: "no token" });
//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
//     req.user = payload;
//     next();
//   } catch (e) {
//     return res.status(403).json({ error: "invalid token" });
//   }
// }

// // ===== Proxy config =====
// // Không dùng pathRewrite vì các service đã mount prefix sẵn (/users, /products...)

// app.use('/users', createProxyMiddleware({
//   target: process.env.USER_SERVICE_URL,
//   changeOrigin: true
// }));

// app.use('/products', createProxyMiddleware({
//   target: process.env.PRODUCT_SERVICE_URL,
//   changeOrigin: true
// }));

// app.use('/orders', authMiddleware, createProxyMiddleware({
//   target: process.env.ORDER_SERVICE_URL,
//   changeOrigin: true
// }));

// app.use('/payments', authMiddleware, createProxyMiddleware({
//   target: process.env.PAYMENT_SERVICE_URL,
//   changeOrigin: true
// }));

// // ===== Start server =====
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));



require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json()); 

// ===== Health check Gateway =====
app.get('/health', (req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

// ===== Middleware verify JWT =====
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "no token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.user = payload;
    next();
  } catch (e) {
    return res.status(403).json({ error: "invalid token" });
  }
}

// =============================
// // USER SERVICE
// // =============================
// // Public routes
// app.use('/users/health', createProxyMiddleware({
//   target: process.env.USER_SERVICE_URL,
//   changeOrigin: true
// }));
// app.use('/users/register', createProxyMiddleware({
//   target: process.env.USER_SERVICE_URL,
//   changeOrigin: true
// }));
// app.use('/users/login', createProxyMiddleware({
//   target: process.env.USER_SERVICE_URL,
//   changeOrigin: true
// }));

// // Protected routes (profile, update, ...)
// app.use('/users', authMiddleware, createProxyMiddleware({
//   target: process.env.USER_SERVICE_URL,
//   changeOrigin: true
// }));

// app.use('/auth', createProxyMiddleware({
//   target: process.env.USER_SERVICE_URL,
//   changeOrigin: true
// }));

// ===== USER SERVICE =====
// Public routes
app.use('/users/health', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/users/health': '/health' }
}));

// POST /users/login → /login hoặc /auth/login
app.use('/users/login', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/users/login': '/auth/login' },
  onProxyReq: (proxyReq, req, res) => {
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
      proxyReq.end(); // **bắt buộc**
    }
  }
}));

// Tương tự /register
app.use('/users/register', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/users/register': '/auth/register' },
  onProxyReq: (proxyReq, req, res) => {
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
      proxyReq.end();
    }
  }
}));

// Protected routes
app.use('/users', authMiddleware, createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true
}));

app.use('/auth', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true
}));

// =============================
// PRODUCT SERVICE
// =============================
// Public routes (xem sản phẩm)
app.use('/products/list', createProxyMiddleware({
  target: process.env.PRODUCT_SERVICE_URL,
  changeOrigin: true
}));

// Protected routes (admin CRUD)
app.use('/products', authMiddleware, createProxyMiddleware({
  target: process.env.PRODUCT_SERVICE_URL,
  changeOrigin: true
}));

// =============================
// ORDER SERVICE (luôn cần auth)
// =============================
app.use('/orders', authMiddleware, createProxyMiddleware({
  target: process.env.ORDER_SERVICE_URL,
  changeOrigin: true
}));

// =============================
// PAYMENT SERVICE (luôn cần auth)
// =============================
app.use('/payments', authMiddleware, createProxyMiddleware({
  target: process.env.PAYMENT_SERVICE_URL,
  changeOrigin: true
}));

// ===== Start server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
