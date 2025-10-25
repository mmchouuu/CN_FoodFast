// api-gateway/src/controllers/customers.controller.js
const customerClient = require('../services/customer.client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role ?? 'customer',
    avatar_url: user.avatar_url ?? user.avatar ?? null,
    tier: user.tier ?? null,
    is_verified: user.is_verified ?? null,
    is_approved: user.is_approved ?? null,
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
      },
    });
    return res.status(201).json(result);
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
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ message: 'email, otp and new_password are required' });
    }
    const result = await customerClient.resetPassword({ email, otp, new_password }, {
      headers: { 'x-request-id': req.id }
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verify, login, listAddresses, createAddress, deleteAddress, requestPasswordReset, resetPassword };
