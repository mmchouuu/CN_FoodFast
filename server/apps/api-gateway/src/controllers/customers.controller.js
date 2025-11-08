// api-gateway/src/controllers/customers.controller.js
const customerClient = require('../services/customer.client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const sanitizeUser = (user) => {
  if (!user) return null;
  const firstName = user.firstName ?? user.first_name ?? null;
  const lastName = user.lastName ?? user.last_name ?? null;
  const email = user.email ?? user.emailAddress ?? null;
  const phone = user.phone ?? user.phoneNumber ?? null;
  const tier = user.tier ?? user.loyaltyTier ?? null;
  const isVerified =
    user.emailVerified ?? user.is_verified ?? user.isVerified ?? null;
  return {
    id: user.id ?? user.userId ?? null,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    role: user.role ?? 'customer',
    avatar_url: user.avatar_url ?? user.avatar ?? user.avatarUrl ?? null,
    tier,
    is_verified: isVerified,
    is_approved: user.is_approved ?? user.isApproved ?? null,
  };
};

const signGatewayToken = (user) => {
  if (!user?.id) return null;
  return jwt.sign(
    {
      userId: user.id,
      role: user.role ?? 'customer',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
};

async function register(req, res, next) {
  try {
    const payload = req.body;
    if (!payload.email || !payload.password)
      return res.status(400).json({ message: 'email and password required' });

    const result = await customerClient.register(payload, {
      headers: { 'x-request-id': req.id }
    });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await customerClient.verify({ email, otp }, {
      headers: { 'x-request-id': req.id }
    });
    const sanitized = sanitizeUser(result?.user);
    const token = signGatewayToken(sanitized || result?.user);
    return res.json({
      message: result?.message || 'Verification successful.',
      user: sanitized,
      token,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await customerClient.login(req.body, {
      headers: { 'x-request-id': req.id }
    });
    const sanitized = sanitizeUser(result?.user);
    const token = signGatewayToken(sanitized || result?.user);
    return res.json({
      message: result?.message || 'Login successful',
      user: sanitized,
      token,
    });
  } catch (err) {
    next(err);
  }
}

async function listAddresses(req, res, next) {
  try {
    const result = await customerClient.listAddresses({
      headers: {
        'x-request-id': req.id,
        'x-user-id': req.user.userId,
        authorization: req.headers.authorization,
      },
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createAddress(req, res, next) {
  try {
    const result = await customerClient.createAddress(req.body, {
      headers: {
        'x-request-id': req.id,
        'x-user-id': req.user.userId,
        authorization: req.headers.authorization,
      },
    });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    const result = await customerClient.updateAddress(req.params.id, req.body, {
      headers: {
        'x-request-id': req.id,
        'x-user-id': req.user.userId,
        authorization: req.headers.authorization,
      },
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function deleteAddress(req, res, next) {
  try {
    await customerClient.deleteAddress(req.params.id, {
      headers: {
        'x-request-id': req.id,
        'x-user-id': req.user.userId,
        authorization: req.headers.authorization,
      },
    });
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email is required' });
    const result = await customerClient.requestPasswordReset({ email }, {
      headers: { 'x-request-id': req.id }
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'email, otp and newPassword are required' });
    }
    const result = await customerClient.resetPassword(
      { email, otp, newPassword },
      { headers: { 'x-request-id': req.id } },
    );
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verify,
  login,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  requestPasswordReset,
  resetPassword,
};
