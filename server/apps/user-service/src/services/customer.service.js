// user-service/src/services/customer.service.js

const userModel = require('../models/user.model');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/emailQueue');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 phút
function createError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}


const adaptAddress = (record) => ({
  id: record.id,
  label: record.label || (record.is_primary ? 'Primary' : 'Address'),
  recipient: record.recipient || null,
  phone: record.phone || null,
  street: record.street,
  ward: record.ward || null,
  district: record.district || null,
  city: record.city || null,
  instructions: record.instructions || null,
  isDefault: record.is_primary === true,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});


// Customer register -> gửi OTP để verify email
async function registerCustomer(payload) {
  const existing = await userModel.findByEmail(payload.email);
  if (existing) throw createError('Email already used', 409);

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
    is_approved: true, // customers không cần admin approve
  });

  await sendOtpEmail(user.email, user.first_name || user.email, otp, 'VERIFY');
  return {
    message: 'Customer registered. OTP sent to email for verification.',
    userId: user.id,
  };
}

// Customer verify => set is_verified true
async function verifyCustomer(email, otp_code) {
  const user = await userModel.findByEmail(email);
  if (!user) throw createError('User not found', 404);
  if (user.role !== 'customer') throw createError('Not a customer account', 403);
  if (!user.otp_code || !user.otp_expires) throw createError('No OTP found', 400);
  if (user.otp_code !== otp_code) throw createError('Invalid OTP', 400);
  if (new Date(user.otp_expires) < new Date()) throw createError('OTP expired', 400);

  const updated = await userModel.updateUser(user.id, { is_verified: true, otp_code: null, otp_expires: null });
  const token = jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '15m' });
  const { password_hash, otp_code: _, otp_expires: __, ...publicUser } = updated;
  return {
    message: 'Email verified. Welcome back!',
    user: publicUser,
    token,
  };
}

// Customer login (email + password)
async function loginCustomer({ email, password }) {
  const normalizedEmail =
    typeof email === 'string' ? email.trim().toLowerCase() : '';
  const plainPassword = typeof password === 'string' ? password : '';

  if (!normalizedEmail || !plainPassword) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }
  if (user.role !== 'customer') {
    throw Object.assign(new Error('Not a customer account'), { statusCode: 403 });
  }
  if (!user.is_verified) {
    throw Object.assign(new Error('Customer account not verified'), { statusCode: 403 });
  }

  const ok = await bcrypt.compare(plainPassword, user.password_hash || '');
  if (!ok) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '15m' });
  return { message: 'Login successful', user, token };
}

async function listAddresses(userId) {
  const rows = await userModel.getAddressesByUserId(userId);
  return rows.map(adaptAddress);
}

async function createAddress(userId, payload) {
  const record = await userModel.createAddress(userId, {
    label: payload.label,
    recipient: payload.recipient,
    phone: payload.phone,
    street: payload.street,
    ward: payload.ward,
    district: payload.district,
    city: payload.city,
    instructions: payload.instructions,
    isDefault: payload.isDefault === true,
  });
  return adaptAddress(record);
}

async function deleteAddress(userId, addressId) {
  const deleted = await userModel.deleteAddress(userId, addressId);
  return deleted;
}

module.exports = {
  registerCustomer,
  verifyCustomer,
  loginCustomer,
  listAddresses,
  createAddress,
  deleteAddress,
};
