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
