const userClient = require('../services/user.client');

async function register(req, res, next) {
  try {
    const payload = req.body;
    // simple validation (expand as needed)
    if (!payload.email || !payload.password) {
      return res.status(400).json({ message: 'email and password required' });
    }

    const result = await userClient.register(payload, { headers: { 'x-request-id': req.id }});
    // result includes { user, token } as returned by user-service
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await userClient.login(req.body, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const result = await userClient.getAll({ headers: { 'x-request-id': req.id } });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function health(req, res, next) {
  try {
    const result = await userClient.health();
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getAll, health };
