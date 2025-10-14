// user-service/src/services/customer.service.js

const userModel = require('../models/user.model');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/emailQueue');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 phút

// Customer register -> gửi OTP để verify email
async function registerCustomer(payload) {
  const existing = await userModel.findByEmail(payload.email);
  if (existing) throw new Error('Email already used');

  const password_hash = await bcrypt.hash(payload.password);
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const user = await userModel.createUser({
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone,
    password_hash,
    role: 'customer',
    otp_code: otp,
    otp_expires: expiresAt,
    is_verified: false,
    is_approved: true // customers không cần admin approve
  });

  await sendOtpEmail(user.email, user.first_name || user.email, otp, 'VERIFY');
  return { message: 'Customer registered. OTP sent to email for verification.' };
}

// Customer verify => set is_verified true
async function verifyCustomer(email, otp_code) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('User not found');
  if (user.role !== 'customer') throw new Error('Not a customer account');
  if (!user.otp_code || !user.otp_expires) throw new Error('No OTP found');
  if (user.otp_code !== otp_code) throw new Error('Invalid OTP');
  if (new Date(user.otp_expires) < new Date()) throw new Error('OTP expired');

  await userModel.updateUser(user.id, { is_verified: true, otp_code: null, otp_expires: null });
  return { message: 'Email verified. You can now login.' };
}

// Customer login (email + password)
async function loginCustomer({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('Invalid credentials');
  if (user.role !== 'customer') throw new Error('Not a customer account');
  if (!user.is_verified) throw new Error('Customer account not verified');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '15m' });
  return { message: 'Login successful', user, token };
}

module.exports = { registerCustomer, verifyCustomer, loginCustomer };