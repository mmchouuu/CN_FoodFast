// generate-jwt.js
// Usage: node generate-jwt.js <userId> <email> <role>
// Example: node generate-jwt.js 1db97b18-cee3-48bc-b9c5-76d35fd5e3e3 a@example.com customer

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const secret = process.env.JWT_SECRET || process.env.SECRET || process.env.JWT_KEY;
if (!secret) {
  console.error("ERROR: Không tìm thấy JWT secret trong .env (JWT_SECRET / SECRET / JWT_KEY).");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node generate-jwt.js <userId> <email> [role]");
  process.exit(1);
}
const [userId, email, role='customer'] = args;

const payload = {
  id: userId,
  email,
  role
};

// tùy project, có thể server dùng expiresIn khác — 1h là ví dụ
const token = jwt.sign(payload, secret, { expiresIn: '7d' });

console.log(token);
