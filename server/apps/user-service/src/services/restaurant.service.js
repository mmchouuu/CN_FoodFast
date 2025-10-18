// user-service/src/services/restaurant.service.js

const crypto = require('crypto');
const userModel = require('../models/user.model');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/emailQueue');
const { publishSocketEvent } = require('../utils/rabbitmq');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateTempPassword(length = 10) {
  return crypto.randomBytes(length)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, length) || crypto.randomBytes(length).toString('hex').slice(0, length);
}

// 1. Restaurant registration
async function registerRestaurant(payload) {
  const {
    firstName,
    lastName,
    restaurantName,
    companyAddress,
    taxCode,
    managerName,
    email,
    phone,
  } = payload;

  if (!firstName || !lastName || !restaurantName || !companyAddress || !taxCode || !email) {
    throw new Error('Missing required fields');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) throw new Error('Email already used');

  const managerLabel = managerName || `${firstName} ${lastName}`.trim();

  const user = await userModel.createUser({
    first_name: firstName,
    last_name: lastName,
    email: normalizedEmail,
    phone,
    role: 'restaurant',
    is_verified: false,
    is_approved: false,
    is_active: false,
    email_verified: false,
    otp_code: null,
    otp_expires: null,
    restaurant_name: restaurantName,
    company_address: companyAddress,
    tax_code: taxCode,
    manager_name: managerLabel,
    restaurant_status: 'pending',
    tier: 'Bronze',
  });

  await publishSocketEvent('restaurant.submitted', {
    restaurantId: user.id,
    email: user.email,
    restaurantName,
  });

  return {
    message: 'Restaurant profile received. Please wait for admin approval.',
    restaurantId: user.id,
  };
}

// 2. Admin approval: generate temporary password + OTP, send email
async function approveRestaurant(id) {
  const user = await userModel.findById(id);
  if (!user) throw new Error('Restaurant not found');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (user.is_approved) throw new Error('Already approved');

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const temporaryPassword = generateTempPassword(12);
  const password_hash = await bcrypt.hash(temporaryPassword);

  const updated = await userModel.updateUser(id, {
    is_approved: true,
    is_verified: false,
    email_verified: false,
    is_active: true,
    restaurant_status: 'approve',
    password_hash,
    otp_code: otp,
    otp_expires: expiresAt,
  });

  await sendOtpEmail({
    to: updated.email,
    name: updated.first_name || updated.email,
    otp,
    password: temporaryPassword,
    purpose: 'RESTAURANT_APPROVAL',
  });

  await publishSocketEvent('restaurant.approved', {
    restaurantId: updated.id,
    email: updated.email,
    restaurantName: updated.restaurant_name,
  });

  return { message: 'Restaurant approved. Credentials sent via email.' };
}

// 3. Verification endpoint to allow password change with OTP
async function verifyRestaurant({ email, otp_code, activationPassword, newPassword }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }
  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) throw new Error('User not found');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (!user.is_approved) throw new Error('Admin has not approved this account yet');
  if (!user.otp_code || !user.otp_expires) throw new Error('No OTP found');
  if (user.otp_code !== otp_code) throw new Error('Invalid OTP');
  if (new Date(user.otp_expires) < new Date()) throw new Error('OTP expired');

  if (!activationPassword) {
    throw new Error('Activation password is required');
  }
  const tempPasswordMatches = await bcrypt.compare(activationPassword, user.password_hash || '');
  if (!tempPasswordMatches) {
    throw new Error('Activation password is incorrect');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const password_hash = await bcrypt.hash(newPassword);

  const updated = await userModel.updateUser(user.id, {
    otp_code: null,
    otp_expires: null,
    is_verified: true,
    email_verified: true,
    is_active: true,
    restaurant_status: 'active',
    password_hash,
  });

  await publishSocketEvent('restaurant.activated', {
    restaurantId: updated.id,
    email: updated.email,
  });

  return { message: 'Verification successful. You can now login.', restaurant: updated };
}

// 4. Restaurant login (email + password)
async function loginRestaurant({ email, password }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }
  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) throw new Error('Invalid credentials');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');
  if (!user.is_approved) throw new Error('Admin has not approved this restaurant yet');
  if (!user.password_hash) throw new Error('Password not set yet. Please complete OTP verification.');

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) throw new Error('Invalid credentials');
  if (!user.is_verified || !user.email_verified) throw new Error('Restaurant account not verified yet');
  if (!user.is_active) throw new Error('Restaurant account is locked');

  const token = jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '15m' });
  return { message: 'Login successful', user, token };
}

async function getRestaurantAccountById(id) {
  const user = await userModel.findById(id);
  if (!user || user.role !== 'restaurant') throw new Error('Restaurant not found');
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    restaurantName: user.restaurant_name,
    managerName: user.manager_name,
    taxCode: user.tax_code,
    companyAddress: user.company_address,
    restaurantStatus: user.restaurant_status,
    isApproved: user.is_approved,
    isActive: user.is_active,
    isVerified: user.is_verified,
  };
}

async function getRestaurantStatus(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      email: '',
      restaurantStatus: 'not_found',
      isApproved: false,
      isActive: false,
      isVerified: false,
    };
  }
  const user = await userModel.findByEmail(normalizedEmail);
  if (!user || user.role !== 'restaurant') {
    return {
      email: normalizedEmail,
      restaurantStatus: 'not_found',
      isApproved: false,
      isActive: false,
      isVerified: false,
    };
  }
  return {
    id: user.id,
    email: user.email,
    isApproved: user.is_approved,
    isActive: user.is_active,
    isVerified: user.is_verified,
    restaurantStatus: user.restaurant_status,
    restaurantName: user.restaurant_name,
    phone: user.phone,
    managerName: user.manager_name,
    taxCode: user.tax_code,
    companyAddress: user.company_address,
  };
}

async function moderateRestaurant(id, action) {
  const allowedActions = ['lock', 'warning', 'active'];
  if (!allowedActions.includes(action)) {
    throw new Error('Unsupported restaurant action');
  }

  const user = await userModel.findById(id);
  if (!user) throw new Error('Restaurant not found');
  if (user.role !== 'restaurant') throw new Error('Not a restaurant account');

  const updates = {};

  if (action === 'lock') {
    updates.is_active = false;
    updates.restaurant_status = user.is_verified ? 'approved' : 'approve';
  } else if (action === 'warning') {
    updates.is_active = true;
    updates.restaurant_status = 'warning';
  } else if (action === 'active') {
    updates.is_active = true;
    updates.restaurant_status = user.is_verified ? 'active' : 'approve';
  }

  const updated = await userModel.updateUser(id, updates);

  await publishSocketEvent('restaurant.moderated', {
    restaurantId: updated.id,
    action,
    restaurantStatus: updated.restaurant_status,
    isActive: updated.is_active,
  });

  return updated;
}

module.exports = {
  registerRestaurant,
  approveRestaurant,
  verifyRestaurant,
  loginRestaurant,
  getRestaurantStatus,
  getRestaurantAccountById,
  moderateRestaurant,
};
