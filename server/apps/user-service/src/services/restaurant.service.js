// user-service/src/services/restaurant.service.js

const userModel = require('../models/user.model');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/emailQueue');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// 1. Restaurant register -> create account without password (waiting for admin approval)
async function registerRestaurant(payload) {
  const { restaurantName, companyAddress, taxCode, managerName, email, phone } = payload;
  if (!restaurantName || !companyAddress || !taxCode || !managerName || !email) {
    throw new Error('Missing required fields');
  }

  const existing = await userModel.findByEmail(email);
  if (existing) throw new Error('Email already used');

  const managerParts = managerName.trim().split(' ');
  const firstName = managerParts[0];
  const lastName = managerParts.slice(1).join(' ');

  const user = await userModel.createUser({
    first_name: firstName,
    last_name: lastName || null,
    email,
    phone,
    role: 'restaurant',
    is_verified: false,
    is_approved: false,
    otp_code: null,
    otp_expires: null,
    restaurant_name: restaurantName,
    company_address: companyAddress,
    tax_code: taxCode,
    manager_name: managerName,
    restaurant_status: 'pending',
  });

  return {
    message: 'Restaurant profile received. Please wait for admin approval.',
    restaurantId: user.id,
  };
}

// 2. Admin approve -> set is_approved true, create OTP and send email
async function approveRestaurant(id) {
  const user = await userModel.findById(id);
  if (!user) throw new Error('Restaurant not found');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (user.is_approved) throw new Error('Already approved');

  await userModel.updateUser(id, { is_approved: true, restaurant_status: 'approved' });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await userModel.updateUser(id, { otp_code: otp, otp_expires: expiresAt });

  await sendOtpEmail(user.email, user.first_name || user.email, otp, 'VERIFY');
  return { message: 'Restaurant approved. OTP sent to email for verification.' };
}

// 3. Restaurant verify after admin approval (set password + confirm email)
async function verifyRestaurant(email, otp_code, password) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('User not found');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (!user.is_approved) throw new Error('Admin has not approved this account yet');
  if (!user.otp_code || !user.otp_expires) throw new Error('No OTP found');
  if (user.otp_code !== otp_code) throw new Error('Invalid OTP');
  if (new Date(user.otp_expires) < new Date()) throw new Error('OTP expired');

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const password_hash = await bcrypt.hash(password);

  await userModel.updateUser(user.id, {
    is_verified: true,
    otp_code: null,
    otp_expires: null,
    password_hash,
    restaurant_status: 'verified',
  });
  return { message: 'Verification successful. You can now login.' };
}

// 4. Login restaurant (email + password) only after approved+verified
async function loginRestaurant({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('Invalid credentials');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (!user.is_approved) throw new Error('Admin has not approved this restaurant yet');
  if (!user.is_verified) throw new Error('Account not verified via email');
  if (!user.password_hash) throw new Error('Password not set yet. Complete OTP verification.');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '15m' });
  return { message: 'Login successful', user, token };
}

module.exports = { registerRestaurant, approveRestaurant, verifyRestaurant, loginRestaurant };
