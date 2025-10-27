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
  const frontendBase = process.env.FRONTEND_BASE_URL
    ? `${process.env.FRONTEND_BASE_URL.replace(/\/$/, '')}/restaurant/auth/verify`
    : null;
  const rawBase =
    process.env.OWNER_VERIFY_URL ||
    frontendBase ||
    'http://localhost:5173/restaurant/auth/verify';
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

async function verifyOwner({ email, otp, temporaryPassword, newPassword }) {
  if (!email || !otp) {
    throw createError('Email and OTP are required');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('User not found', 404);
  }

  let roles = await userRepository.getUserRoleCodes(user.id);
  if (!roles.includes('owner')) {
    const ownerProfile = await userRepository.getOwnerProfileByUserId(user.id);
    if (ownerProfile) {
      const role = await ensureOwnerRole();
      await userRepository.assignRole(user.id, role.id);
      roles = await userRepository.getUserRoleCodes(user.id);
    }
  }
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

  let passwordUpdated = false;
  const tempProvided =
    typeof temporaryPassword === 'string' && temporaryPassword.trim().length > 0;
  const newProvided =
    typeof newPassword === 'string' && newPassword.trim().length > 0;

  if (tempProvided !== newProvided) {
    throw createError('Temporary password and new password must both be provided', 400);
  }
  if (newProvided && newPassword.trim().length < 8) {
    throw createError('New password must be at least 8 characters long', 400);
  }

  const hasPasswordPayload = tempProvided && newProvided;

  if (hasPasswordPayload) {
    const role = await ensureOwnerRole();
    const credential = await userRepository.getCredential(user.id, role.id);
    if (!credential) {
      throw createError('Owner credentials not found', 404);
    }

    if (credential.is_temp) {
      const matches = await bcrypt.compare(temporaryPassword.trim(), credential.password_hash);
      if (!matches) {
        throw createError('Temporary password is invalid', 401);
      }

      const hash = await bcrypt.hash(newPassword.trim());
      await userRepository.upsertCredential({
        userId: user.id,
        roleId: role.id,
        passwordHash: hash,
        isTemp: false,
      });
      passwordUpdated = true;
    }
  }

  publishSocketEvent(
    'owner.email.verified',
    {
      ownerId: user.id,
      email: normalizedEmail,
    },
    [`restaurant-owner:${user.id}`],
  );

  return {
    message: passwordUpdated
      ? 'Verification successful. Password updated.'
      : 'Verification successful. Please set a new password using the temporary password.',
    requiresPasswordReset: !passwordUpdated,
    passwordUpdated,
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
    throw createError('ownerId is required');
  }

  const owner = await userRepository.findById(ownerId);
  if (!owner) {
    throw createError('Owner not found', 404);
  }

  let profile = await userRepository.getOwnerProfileByUserId(ownerId);
  if (!profile) {
    const fallbackName = `${owner.first_name || ''} ${owner.last_name || ''}`.trim()
      || owner.email
      || 'Owner';
    profile = await userRepository.createOwnerProfile(
      {
        userId: ownerId,
        legalName: fallbackName,
        taxCode: null,
        companyAddress: null,
        managerName: fallbackName,
      },
    );
  }
  if (profile.status === 'approved') {
    return { message: 'Owner already approved' };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword);
  const otpCode = generateOTP();
  const verifyLink = buildOwnerVerifyLink(owner.email, otpCode);

  await withTransaction(async (client) => {
    const role = await ensureOwnerRole(client);

    await userRepository.updateOwnerProfile(
      ownerId,
      {
        status: 'approved',
        approvedBy: adminUserId || null,
        approvedAt: new Date(),
      },
      client,
    );

    await userRepository.upsertCredential(
      {
        userId: ownerId,
        roleId: role.id,
        passwordHash,
        isTemp: true,
      },
      client,
    );

    await tokenRepository.createToken(
      {
        userId: ownerId,
        purpose: 'verify_email',
        code: otpCode,
        ttlMs: OTP_TTL_MS,
      },
      client,
    );
  });

  await sendOtpEmail({
    to: owner.email,
    name: owner.first_name || owner.email,
    otp: otpCode,
    password: temporaryPassword,
    verifyLink,
    purpose: 'OWNER_VERIFY',
  });

  publishSocketEvent(
    'owner.approved',
    {
      ownerId,
      adminUserId: adminUserId || null,
    },
    ['admin:restaurants', `restaurant-owner:${ownerId}`],
  );

  return { message: 'Owner approved. Verification email sent.' };
}

async function resendOwnerVerification({ email }) {
  if (!email) {
    throw createError('Email is required');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const owner = await userRepository.findByEmail(normalizedEmail);
  if (!owner) {
    throw createError('Owner not found', 404);
  }
  const profile = await userRepository.getOwnerProfileByUserId(owner.id);
  if (!profile || profile.status !== 'approved') {
    throw createError('Owner account is not approved yet', 400);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword);
  const otpCode = generateOTP();
  const verifyLink = buildOwnerVerifyLink(owner.email, otpCode);

  await withTransaction(async (client) => {
    const role = await ensureOwnerRole(client);
    await userRepository.upsertCredential(
      {
        userId: owner.id,
        roleId: role.id,
        passwordHash,
        isTemp: true,
      },
      client,
    );
    await tokenRepository.createToken(
      {
        userId: owner.id,
        purpose: 'verify_email',
        code: otpCode,
        ttlMs: OTP_TTL_MS,
      },
      client,
    );
  });

  await sendOtpEmail({
    to: owner.email,
    name: owner.first_name || owner.email,
    otp: otpCode,
    password: temporaryPassword,
    verifyLink,
    purpose: 'OWNER_VERIFY',
  });

  publishSocketEvent(
    'owner.verification.resent',
    {
      ownerId: owner.id,
    },
    [`restaurant-owner:${owner.id}`],
  );

  return { message: 'Verification email resent. Please check your inbox.' };
}

async function adminRejectOwner({ ownerId, adminUserId, reason }) {
  if (!ownerId) {
    throw createError('ownerId is required');
  }
  const owner = await userRepository.findById(ownerId);
  if (!owner) {
    throw createError('Owner not found', 404);
  }
  const profile = await userRepository.getOwnerProfileByUserId(ownerId);
  if (!profile) {
    throw createError('Owner profile not found', 404);
  }
  await userRepository.updateOwnerProfile(ownerId, {
    status: 'rejected',
    approvedBy: adminUserId || null,
    approvedAt: new Date(),
  });

  await sendOtpEmail({
    to: owner.email,
    name: owner.first_name || owner.email,
    purpose: 'OWNER_REJECTED',
    reason,
  });

  publishSocketEvent(
    'owner.rejected',
    {
      ownerId,
      adminUserId: adminUserId || null,
      reason: reason || null,
    },
    ['admin:restaurants'],
  );

  return { message: 'Owner rejected.' };
}

async function createOwnerMainAccount({
  restaurantId,
  ownerUserId,
  loginEmail,
  displayName,
  phone,
  temporaryPassword,
}) {
  if (!restaurantId || !ownerUserId || !loginEmail || !temporaryPassword) {
    throw createError('Missing required fields');
  }

  const passwordHash = await bcrypt.hash(temporaryPassword);
  const account = await withTransaction(async (client) => {
    const createdAccount = await restaurantAccountRepository.createAccount(
      {
        restaurantId,
        loginEmail,
        displayName: displayName || loginEmail,
        phone: phone || null,
        userId: ownerUserId,
      },
      client,
    );

    await restaurantAccountRepository.upsertCredential(
      {
        accountId: createdAccount.id,
        passwordHash,
        isTemp: true,
      },
      client,
    );

    const membership = await restaurantAccountRepository.assignMembership(
      {
        accountId: createdAccount.id,
        restaurantId,
        branchId: null,
        role: 'owner_main',
      },
      client,
    );

    return { account: createdAccount, membership };
  });

  return {
    message: 'Owner main account created',
    account: account.account,
    membership: account.membership,
  };
}

async function createRestaurantMember({
  restaurantId,
  branchId,
  loginEmail,
  displayName,
  phone,
  role,
  temporaryPassword,
  permissions,
}) {
  if (!restaurantId || !loginEmail || !role || !temporaryPassword) {
    throw createError('Missing required fields');
  }

  const allowedRoles = ['owner', 'manager', 'staff'];
  if (!allowedRoles.includes(role)) {
    throw createError('Unsupported role');
  }

  const passwordHash = await bcrypt.hash(temporaryPassword);
  const result = await withTransaction(async (client) => {
    const account = await restaurantAccountRepository.createAccount(
      {
        restaurantId,
        loginEmail,
        displayName: displayName || loginEmail,
        phone: phone || null,
        userId: null,
      },
      client,
    );

    await restaurantAccountRepository.upsertCredential(
      {
        accountId: account.id,
        passwordHash,
        isTemp: true,
      },
      client,
    );

    const membership = await restaurantAccountRepository.assignMembership(
      {
        accountId: account.id,
        restaurantId,
        branchId: branchId || null,
        role,
        permissions: permissions || {},
      },
      client,
    );

    return { account, membership };
  });

  return {
    message: 'Restaurant member created',
    account: result.account,
    membership: result.membership,
  };
}

async function setOwnerPassword({ email, temporaryPassword, newPassword }) {
  const cleanEmail = typeof email === 'string' ? email.trim() : '';
  const cleanTempPassword =
    typeof temporaryPassword === 'string' ? temporaryPassword.trim() : '';
  const cleanNewPassword =
    typeof newPassword === 'string' ? newPassword.trim() : '';

  if (!cleanEmail || !cleanTempPassword || !cleanNewPassword) {
    throw createError('Email, temporary password and new password are required');
  }
  if (cleanNewPassword.length < 8) {
    throw createError('New password must be at least 8 characters long');
  }

  const normalizedEmail = cleanEmail.toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw createError('User not found', 404);
  }
  if (!user.email_verified) {
    throw createError('Email not verified yet', 403);
  }

  const role = await ensureOwnerRole();
  const credential = await userRepository.getCredential(user.id, role.id);
  if (!credential) {
    throw createError('Owner credentials not found', 404);
  }
  if (!credential.is_temp) {
    throw createError('Password already set', 400);
  }

  const tempMatches = await bcrypt.compare(cleanTempPassword, credential.password_hash);
  if (!tempMatches) {
    throw createError('Temporary password is invalid', 401);
  }

  const passwordHash = await bcrypt.hash(cleanNewPassword);
  await userRepository.upsertCredential({
    userId: user.id,
    roleId: role.id,
    passwordHash,
    isTemp: false,
  });

  return { message: 'Password updated successfully. You can now login.' };
}

module.exports = {
  registerOwner,
  verifyOwner,
  ownerLogin,
  getOwnerStatus,
  adminApproveOwner,
  resendOwnerVerification,
  adminRejectOwner,
  createOwnerMainAccount,
  createRestaurantMember,
  setOwnerPassword,
};
