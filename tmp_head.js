const crypto = require('crypto');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/emailQueue');
const { publishSocketEvent } = require('../utils/rabbitmq');
const { withTransaction } = require('../db');
const roleRepository = require('../repositories/role.repository');
const userRepository = require('../repositories/user.repository');
const tokenRepository = require('../repositories/userToken.repository');
const restaurantAccountRepository = require('../repositories/restaurantAccount.repository');

const OTP_TTL_MS = 5 * 60 * 1000;

function generateTemporaryPassword(length = 12) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
  let password = '';
  while (password.length < length) {
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < randomBytes.length && password.length < length; i += 1) {
      const index = randomBytes[i] % charset.length;
      password += charset[index];
    }
  }
  return password;
}

function buildOwnerVerifyLink(email, otp) {
  const rawBase =
    process.env.OWNER_VERIFY_URL ||
    process.env.FRONTEND_BASE_URL ||
    'https://owner.foodfast.local/verify';
  try {
    const url = new URL(rawBase);
    url.searchParams.set('email', email);
    url.searchParams.set('otp', otp);
    return url.toString();
  } catch (error) {
    const separator = rawBase.includes('?') ? '&' : '?';
    return `${rawBase}${separator}email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`;
  }
}

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function ensureOwnerRole(client) {
  await roleRepository.ensureGlobalRoles(client);
  const role = await roleRepository.getRoleByCode('owner', client);
  if (!role) {
    throw createError('Owner role missing', 500);
  }
  return role;
}

async function registerOwner(payload = {}) {
  const {
    email,
    firstName,
    lastName,
    phone,
    legalName,
    taxCode,
    companyAddress,
    managerName,
  } = payload;

  if (!email || !legalName || !taxCode || !companyAddress) {
    throw createError('Missing required fields');
  }

  const normalizedEmail = email.trim().toLowerCase();
  let owner = null;

  await withTransaction(async (client) => {
    const role = await ensureOwnerRole(client);
    const existing = await userRepository.findByEmail(normalizedEmail, client);
    if (existing) {
      const roles = await userRepository.getUserRoleCodes(existing.id, client);
      if (roles.includes('owner')) {
        throw createError('Email already registered', 409);
      }
    }

    const userRecord = existing
      ? await userRepository.updateUser(
          existing.id,
          {
            firstName: firstName ?? existing.first_name,
            lastName: lastName ?? existing.last_name,
            phone: phone ?? existing.phone,
            isActive: true,
          },
          client,
        )
      : await userRepository.createUser(
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

    owner = userRecord;

    await userRepository.assignRole(owner.id, role.id, client);

    await userRepository.createOwnerProfile(
      {
        userId: owner.id,
        legalName,
        taxCode,
        companyAddress,
        managerName: managerName || `${firstName || ''} ${lastName || ''}`.trim() || null,
      },
      client,
    );

  });

  if (owner) {
    publishSocketEvent(
      'owner.registration.submitted',
      {
        ownerId: owner.id,
        email: normalizedEmail,
      },
      ['admin:restaurants'],
    );
  }

  return {
    message: 'Registration received. Please wait for admin approval.',
  };
}

async function verifyOwner({ email, otp }) {
  if (!email || !otp) {
    throw createError('Email and OTP are required');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('User not found', 404);
  }

  const roles = await userRepository.getUserRoleCodes(user.id);
  if (!roles.includes('owner')) {
    throw createError('Not an owner account', 403);
  }

  const token = await tokenRepository.consumeToken({
    userId: user.id,
    purpose: 'verify_email',
    code: otp,
  });

  if (!token.success) {
    throw createError('OTP invalid or expired', 400);
  }

  await userRepository.updateUser(user.id, { emailVerified: true });

  publishSocketEvent(
    'owner.email.verified',
    {
      ownerId: user.id,
      email: normalizedEmail,
    },
    [`restaurant-owner:${user.id}`],
  );

  return {
    message: 'Verification successful. Please set a new password using the temporary password.',
    requiresPasswordReset: true,
  };
}

async function ownerLogin({ email, password }) {
  if (!email || !password) {
    throw createError('Email and password are required', 401);
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('Invalid credentials', 401);
  }

  const role = await roleRepository.getRoleByCode('owner');
  const credential = await userRepository.getCredential(user.id, role.id);
  if (!credential) {
    throw createError('Invalid credentials', 401);
  }
  if (credential.is_temp) {
    throw createError('Password reset required before login', 403);
  }

  const ok = await bcrypt.compare(password, credential.password_hash);
  if (!ok) {
    throw createError('Invalid credentials', 401);
  }

  if (!user.email_verified) {
    throw createError('Email not verified', 403);
  }

  const ownerProfile = await userRepository.getOwnerProfileByUserId(user.id);
  if (!ownerProfile) {
    throw createError('Owner profile not found', 404);
  }
  if (ownerProfile.status !== 'approved') {
    throw createError('Owner account pending approval', 403);
  }

  const token = jwt.sign({ userId: user.id, role: 'owner' }, { expiresIn: '1h' });
  return {
    message: 'Login successful',
    token,
    owner: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      profile: ownerProfile,
    },
  };
}

async function getOwnerStatus(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return { status: 'not_found' };
  }
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    return { status: 'not_found' };
  }
  const profile = await userRepository.getOwnerProfileByUserId(user.id);
  if (!profile) {
    return { status: 'not_found' };
  }
  return {
    status: profile.status,
    emailVerified: user.email_verified,
    ownerId: user.id,
    legalName: profile.legal_name,
    taxCode: profile.tax_code,
  };
}

async function adminApproveOwner({ ownerId, adminUserId }) {
  if (!ownerId) {
