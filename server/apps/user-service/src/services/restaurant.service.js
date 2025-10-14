// user-service/src/services/restaurant.service.js

const userModel = require('../models/user.model');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/emailQueue');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 phút

// 1. Restaurant register -> tạo account (is_approved=false, is_verified=false), không gửi OTP
async function registerRestaurant(payload) {
  const existing = await userModel.findByEmail(payload.email);
  if (existing) throw new Error('Email already used');

  const password_hash = await bcrypt.hash(payload.password || '');
  const user = await userModel.createUser({
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone,
    password_hash,
    role: 'restaurant',
    is_verified: false,
    is_approved: false,
    otp_code: null,
    otp_expires: null
  });

  return { message: 'Restaurant registered. Waiting for admin approval.', userId: user.id };
}

// 2. Admin approve -> set is_approved true, tạo OTP và gửi email
async function approveRestaurant(id) {
  const user = await userModel.findById(id);
  if (!user) throw new Error('Restaurant not found');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (user.is_approved) throw new Error('Already approved');

  await userModel.updateUser(id, { is_approved: true });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await userModel.updateUser(id, { otp_code: otp, otp_expires: expiresAt });

  await sendOtpEmail(user.email, user.first_name || user.email, otp, 'VERIFY');
  return { message: 'Restaurant approved. OTP sent to email for verification.' };
}

// 3. Restaurant verify after admin approved
async function verifyRestaurant(email, otp_code) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('User not found');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (!user.is_approved) throw new Error('Admin has not approved this account yet');
  if (!user.otp_code || !user.otp_expires) throw new Error('No OTP found');
  if (user.otp_code !== otp_code) throw new Error('Invalid OTP');
  if (new Date(user.otp_expires) < new Date()) throw new Error('OTP expired');

  await userModel.updateUser(user.id, { is_verified: true, otp_code: null, otp_expires: null });
  return { message: 'Email verified. You can now login.' };
}

// 4. Login restaurant (email + password) only after approved+verified
async function loginRestaurant({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('Invalid credentials');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (!user.is_approved) throw new Error('Admin has not approved this restaurant yet');
  if (!user.is_verified) throw new Error('Account not verified via email');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '15m' });
  return { message: 'Login successful', user, token };
}

module.exports = { registerRestaurant, approveRestaurant, verifyRestaurant, loginRestaurant };