const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/emailQueue');
const { withTransaction } = require('../db');
const roleRepository = require('../repositories/role.repository');
const userRepository = require('../repositories/user.repository');
const tokenRepository = require('../repositories/userToken.repository');
const addressRepository = require('../repositories/address.repository');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;

function sanitizeAddress(address) {
  if (!address) return address;
  const { phone, ...rest } = address;
  return rest;
}

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function ensureCustomerRole(client) {
  await roleRepository.ensureGlobalRoles(client);
  const role = await roleRepository.getRoleByCode('customer', client);
  if (!role) {
    throw createError('customer role missing in database', 500);
  }
  return role;
}


// const adaptAddress = (record) => ({
//   id: record.id,
//   label: record.label || (record.is_primary ? 'Primary' : 'Address'),
//   recipient: record.recipient || null,
//   phone: record.phone || null,
//   street: record.street,
//   ward: record.ward || null,
//   district: record.district || null,
//   city: record.city || null,
//   instructions: record.instructions || null,
//   isDefault: record.is_primary === true,
//   createdAt: record.created_at,
//   updatedAt: record.updated_at,
// });


// Customer register -> gửi OTP để verify email
async function registerCustomer(payload) {
  const { email, password, firstName, lastName, phone } = payload || {};
  if (!email || !password) {
    throw createError('Email and password are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otpCode = generateOTP();

  let user;
  await withTransaction(async (client) => {
    const role = await ensureCustomerRole(client);
    const existing = await userRepository.findByEmail(normalizedEmail, client);

    if (existing) {
      const roles = await userRepository.getUserRoleCodes(existing.id, client);
      if (roles.includes('customer') && existing.email_verified) {
        throw createError('Email already registered', 409);
      } user = await userRepository.updateUser(
        existing.id,
        {
          firstName: firstName ?? existing.first_name,
          lastName: lastName ?? existing.last_name,
          phone: phone ?? existing.phone,
          isActive: true,
          emailVerified: false,
        },
        client,
      );
    } else {
      user = await userRepository.createUser(
        {
          email: normalizedEmail,
          firstName,
          lastName,
          phone,
          isActive: true,
          emailVerified: false,
        },
        client,
      );
    }


    await userRepository.assignRole(user.id, role.id, client);
    const passwordHash = await bcrypt.hash(password);
    await userRepository.upsertCredential(
      {
        userId: user.id,
        roleId: role.id,
        passwordHash,
        isTemp: false,
      },
      client,

    );
    await userRepository.createCustomerProfile(user.id, client);

    await tokenRepository.createToken(
      {
        userId: user.id,
        purpose: 'verify_email',
        code: otpCode,
        ttlMs: OTP_TTL_MS,
      },
      client,
    );
  });

  await sendOtpEmail(normalizedEmail, firstName || normalizedEmail, otpCode, 'VERIFY');
  return {
    message: 'Customer registered, please verify email to activate account.',
  };
}

async function verifyCustomer(email, otp) {
  if (!email || !otp) {
    throw createError('Email and OTP are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('User not found', 404);
  }

  const roles = await userRepository.getUserRoleCodes(user.id);
  if (!roles.includes('customer')) {
    throw createError('Account is not a customer', 403);
  }

  const tokenResult = await tokenRepository.consumeToken({
    userId: user.id,
    purpose: 'verify_email',
    code: otp,
  });

  if (!tokenResult.success) {
    if (tokenResult.reason === 'invalid_code') {
      throw createError('OTP invalid', 400);
    }
    throw createError('OTP not found or expired', 400);
  }

  await userRepository.updateUser(user.id, { emailVerified: true });
  const accessToken = jwt.sign({ userId: user.id, role: 'customer' }, { expiresIn: '1h' });

  return {
    message: 'Verification successful',
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      emailVerified: true,
    },
  };
}

async function loginCustomer({ email, password }) {
  if (!email || !password) {
    throw createError('Email and password are required', 401);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('Invalid credentials', 401);
  }

  const roles = await userRepository.getUserRoleCodes(user.id);
  if (!roles.includes('customer')) {
    throw createError('Invalid credentials', 401);
  }

  if (!user.email_verified) {
    throw createError('Account not verified', 403);
  }

  const role = await roleRepository.getRoleByCode('customer');
  const credential = await userRepository.getCredential(user.id, role.id);
  if (!credential) {
    throw createError('Invalid credentials', 401);
  }

  const ok = await bcrypt.compare(password, credential.password_hash);
  if (!ok) {
    throw createError('Invalid credentials', 401);
  }

  const token = jwt.sign({ userId: user.id, role: 'customer' }, { expiresIn: '1h' });
  const profile = await userRepository.getCustomerProfile(user.id);

  return {
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      emailVerified: user.email_verified,
      profile,
    },
  };
}

async function listAddresses(userId) {
  const addresses = await addressRepository.listByUserId(userId);
  return addresses.map(sanitizeAddress);
}

async function createAddress(userId, payload) {
  if (!payload || !payload.street) {
    throw createError('Street is required');
  }
  const created = await withTransaction((client) =>
    addressRepository.createAddress(userId, payload, client),
  );
  return sanitizeAddress(created);
}

async function updateAddress(userId, addressId, payload) {
  if (!addressId) {
    throw createError('Address id is required');
  }
  if (!payload || typeof payload !== 'object' || !Object.keys(payload).length) {
    throw createError('Update payload is required');
  }

  const updated = await withTransaction((client) =>
    addressRepository.updateAddress(userId, addressId, payload, client),
  );
  return sanitizeAddress(updated);
}

async function deleteAddress(userId, addressId) {
  if (!addressId) {
    throw createError('Address id is required');
  }
  return withTransaction((client) => addressRepository.deleteAddress(userId, addressId, client));
}

async function requestPasswordReset(email) {
  if (!email) {
    throw createError('Email is required');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    return { message: 'If an account exists we have sent instructions.' };
  }

  const roles = await userRepository.getUserRoleCodes(user.id);
  if (!roles.includes('customer')) {
    return { message: 'If an account exists we have sent instructions.' };
  }

  const otpCode = generateOTP();
  await tokenRepository.createToken({
    userId: user.id,
    purpose: 'reset',
    code: otpCode,
    ttlMs: RESET_TTL_MS,
  });

  await sendOtpEmail(normalizedEmail, user.first_name || normalizedEmail, otpCode, 'RESET');
  return { message: 'If an account exists we have sent instructions.' };
}

async function resetPassword({ email, otp, newPassword }) {
  if (!email || !otp || !newPassword) {
    throw createError('Email, OTP and new password are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('User not found', 404);
  }

  const role = await roleRepository.getRoleByCode('customer');

  const tokenResult = await tokenRepository.consumeToken({
    userId: user.id,
    purpose: 'reset',
    code: otp,
  });

  if (!tokenResult.success) {
    throw createError('OTP invalid or expired', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword);
  await userRepository.upsertCredential({
    userId: user.id,
    roleId: role.id,
    passwordHash,
    isTemp: false,
  });

  return { message: 'Password updated successfully' };
}

async function resendVerificationOtp(email) {
  if (!email) {
    throw createError('Email is required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('User not found', 404);
  }

  const roles = await userRepository.getUserRoleCodes(user.id);
  if (!roles.includes('customer')) {
    throw createError('Account is not a customer', 403);
  }

  if (user.email_verified) {
    throw createError('Account already verified', 400);
  }

  const existingToken = await tokenRepository.getActiveToken({
    userId: user.id,
    purpose: 'verify_email',
  });

  if (existingToken) {
    const expiresAt = new Date(existingToken.expires_at);
    if (expiresAt.getTime() > Date.now()) {
      const secondsLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
      throw createError(
        `OTP already sent. Please wait ${Math.ceil(secondsLeft / 60)} minute(s) before requesting again.`,
        429,
      );
    }
  }

  const otpCode = generateOTP();
  await tokenRepository.createToken({
    userId: user.id,
    purpose: 'verify_email',
    code: otpCode,
    ttlMs: OTP_TTL_MS,
  });
  await sendOtpEmail(normalizedEmail, user.first_name || normalizedEmail, otpCode, 'VERIFY');

  return {
    message: 'A new OTP has been sent to your email.',
  };
}

async function getProfile(userId) {
  if (!userId) {
    throw createError('userId is required');
  }

  // Load both sources: base user row (has phone/email) and customer profile
  const [user, profile] = await Promise.all([
    userRepository.findById(userId),
    userRepository.getCustomerProfile(userId),
  ]);

  if (!user && !profile) {
    return null;
  }

  const firstName = profile?.first_name ?? user?.first_name ?? null;
  const lastName = profile?.last_name ?? user?.last_name ?? null;
  const fullName =
    profile?.full_name ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    null;
  const phone = profile?.phone ?? user?.phone ?? null;
  const email = profile?.email ?? user?.email ?? null;

  return {
    id: profile?.id || null,
    user_id: user?.id || profile?.user_id || userId,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    phone,
    email,
  };
}

module.exports = {
  registerCustomer,
  verifyCustomer,
  loginCustomer,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  requestPasswordReset,
  resetPassword,
  resendVerificationOtp,
  getProfile,
};
