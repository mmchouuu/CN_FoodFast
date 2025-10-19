const model = require('../models/address.model');

function serialize(address) {
  if (!address) return null;
  return {
    id: address.id,
    street: address.street,
    ward: address.ward,
    district: address.district,
    city: address.city,
    recipient: address.recipient,
    phone: address.phone,
    instructions: address.instructions,
    label: address.label,
    is_default: Boolean(address.is_primary),
    created_at: address.created_at,
    updated_at: address.updated_at,
  };
}

function getUserId(req) {
  return req.user?.userId || req.user?.id || null;
}

async function list(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' });
    }
    const addresses = await model.listByUser(userId);
    res.json(addresses.map(serialize));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' });
    }
    const address = await model.findById(userId, req.params.id);
    if (!address) {
      return res.status(404).json({ message: 'address not found' });
    }
    res.json(serialize(address));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    const created = await model.createAddress(userId, req.body);
    res.status(201).json(serialize(created));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' });
    }
    const updated = await model.updateAddress(userId, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: 'address not found' });
    }
    res.json(serialize(updated));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' });
    }
    const deleted = await model.deleteAddress(userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'address not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function setDefault(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' });
    }
    const updated = await model.setPrimary(userId, req.params.id);
    if (!updated) {
      return res.status(404).json({ message: 'address not found' });
    }
    res.json(serialize(updated));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, setDefault };
