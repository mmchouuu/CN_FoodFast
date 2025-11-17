const restaurantClient = require('../services/restaurant.client');

function badRequest(res, message) {
  return res.status(400).json({ message });
}

function handleServiceError(err, res, next) {
  if (err && err.status) {
    return res.status(err.status).json(err.data || { message: err.message });
  }
  return next(err);
}

function ensureFields(body, fields) {
  const missing = [];
  fields.forEach((field) => {
    const value = body[field];
    if (value === undefined || value === null) {
      missing.push(field);
      return;
    }
    if (typeof value === 'string' && value.trim() === '') {
      missing.push(field);
    }
  });
  return missing;
}

async function ownerSignup(req, res, next) {
  try {
    const payload = { ...(req.body || {}) };

    if (!payload.legalName && payload.restaurantName) {
      payload.legalName = payload.restaurantName;
    }
    if (!payload.companyAddress && payload.businessAddress) {
      payload.companyAddress = payload.businessAddress;
    }

    const missing = ensureFields(payload, ['email', 'legalName', 'taxCode', 'companyAddress']);
    if (missing.length) {
      return badRequest(res, `Missing required fields: ${missing.join(', ')}`);
    }

    const result = await restaurantClient.signupOwner(payload, {
      headers: { 'x-request-id': req.id },
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function ownerVerify(req, res, next) {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return badRequest(res, 'email and otp are required');
    }
    const result = await restaurantClient.verifyOwner(req.body, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function ownerLogin(req, res, next) {
  try {
    const result = await restaurantClient.ownerLogin(req.body, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function accountLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return badRequest(res, 'email and password are required');
    }
    const result = await restaurantClient.loginRestaurantAccount(req.body, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function ownerStatus(req, res, next) {
  try {
    const { email } = req.query || {};
    if (!email) {
      return badRequest(res, 'email query param is required');
    }
    const result = await restaurantClient.ownerStatus(email, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function resendVerification(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return badRequest(res, 'email is required');
    }
    const result = await restaurantClient.resendVerification(
      { email },
      { headers: { 'x-request-id': req.id } },
    );
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listCatalog(req, res, next) {
  try {
    const params = { ...(req.query || {}) };
    const result = await restaurantClient.listCatalog(params, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getCatalog(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const params = { ...(req.query || {}) };
    const result = await restaurantClient.getCatalog(restaurantId, params, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getRestaurant(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const result = await restaurantClient.getRestaurant(restaurantId, {
      headers: { 'x-request-id': req.id },
    });
    if (!result) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getRestaurantByOwner(req, res, next) {
  try {
    const { ownerId } = req.params;
    if (!ownerId) {
      return badRequest(res, 'ownerId is required');
    }
    const result = await restaurantClient.getRestaurantByOwner(ownerId, {
      headers: { 'x-request-id': req.id },
    });
    if (!result) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listRestaurantsByOwner(req, res, next) {
  try {
    const { ownerId } = req.params;
    if (!ownerId) {
      return badRequest(res, 'ownerId is required');
    }
    const result = await restaurantClient.listRestaurantsByOwner(ownerId, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createRestaurant(req, res, next) {
  try {
    const body = { ...(req.body || {}) };
    const ownerId = body.ownerUserId || body.ownerId || body.owner_id;
    if (!ownerId) {
      return badRequest(res, 'ownerUserId is required');
    }
    if (!body.name || (typeof body.name === 'string' && !body.name.trim())) {
      return badRequest(res, 'Restaurant name is required');
    }

    body.ownerUserId = ownerId;

    const ownerMain = { ...(body.ownerMainAccount || body.ownerMain || {}) };
    if (!ownerMain.loginEmail) {
      ownerMain.loginEmail =
        body.ownerLoginEmail || body.ownerEmail || body.loginEmail || body.email || null;
    }
    if (ownerMain.loginEmail) {
      ownerMain.loginEmail = String(ownerMain.loginEmail).trim().toLowerCase();
    }
    if (!ownerMain.loginEmail) {
      return badRequest(res, 'ownerMainAccount.loginEmail is required');
    }

    body.ownerMainAccount = ownerMain;
    delete body.ownerMain;
    delete body.ownerId;
    delete body.owner_id;

    const result = await restaurantClient.createRestaurant(body, req);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateRestaurant(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const result = await restaurantClient.updateRestaurant(restaurantId, req.body || {}, req);
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createBranch(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const branch = await restaurantClient.createBranch(restaurantId, req.body || {}, req);
    return res.status(201).json(branch);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listBranches(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const result = await restaurantClient.listBranches(restaurantId, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateBranch(req, res, next) {
  try {
    const { restaurantId, branchId } = req.params;
    if (!restaurantId || !branchId) {
      return badRequest(res, 'restaurantId and branchId are required');
    }
    const result = await restaurantClient.updateBranch(restaurantId, branchId, req.body || {}, req);
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateBranchSchedules(req, res, next) {
  try {
    const { restaurantId, branchId } = req.params;
    if (!restaurantId || !branchId) {
      return badRequest(res, 'restaurantId and branchId are required');
    }
    const result = await restaurantClient.updateBranchSchedules(
      restaurantId,
      branchId,
      req.body || {},
      req,
    );
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function deleteBranch(req, res, next) {
  try {
    const { restaurantId, branchId } = req.params;
    if (!restaurantId || !branchId) {
      return badRequest(res, 'restaurantId and branchId are required');
    }
    await restaurantClient.deleteBranch(restaurantId, branchId, req);
    return res.status(204).end();
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function inviteMember(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const missing = ensureFields(req.body || {}, ['loginEmail', 'role']);
    if (missing.length) {
      return badRequest(res, `Missing required fields: ${missing.join(', ')}`);
    }
    const result = await restaurantClient.inviteMember(restaurantId, req.body, req);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listMembers(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const result = await restaurantClient.listRestaurantMembers(restaurantId, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createCategory(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const missing = ensureFields(req.body || {}, ['name']);
    if (missing.length) {
      return badRequest(res, `Missing required fields: ${missing.join(', ')}`);
    }
    const result = await restaurantClient.createCategory(restaurantId, req.body, req);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listCategories(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const result = await restaurantClient.listCategories(restaurantId, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createProduct(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const missing = ensureFields(req.body || {}, ['title', 'basePrice']);
    if (missing.length) {
      return badRequest(res, `Missing required fields: ${missing.join(', ')}`);
    }
    const result = await restaurantClient.createProduct(restaurantId, req.body, req);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listProducts(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const result = await restaurantClient.listProducts(restaurantId, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    if (!restaurantId || !productId) {
      return badRequest(res, 'restaurantId and productId are required');
    }
    const result = await restaurantClient.updateProduct(restaurantId, productId, req.body || {}, req);
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    if (!restaurantId || !productId) {
      return badRequest(res, 'restaurantId and productId are required');
    }
    await restaurantClient.deleteProduct(restaurantId, productId, req);
    return res.status(204).end();
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listInventory(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    if (!restaurantId || !productId) {
      return badRequest(res, 'restaurantId and productId are required');
    }
    const result = await restaurantClient.listInventory(restaurantId, productId, {
      headers: { 'x-request-id': req.id },
    });
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateInventory(req, res, next) {
  try {
    const { restaurantId, branchId, productId } = req.params;
    if (!restaurantId || !branchId || !productId) {
      return badRequest(res, 'restaurantId, branchId and productId are required');
    }
    const result = await restaurantClient.updateInventory(
      restaurantId,
      branchId,
      productId,
      req.body || {},
      req,
    );
    return res.json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createOptionGroup(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    if (!restaurantId || !productId) {
      return badRequest(res, 'restaurantId and productId are required');
    }
    const missing = ensureFields(req.body || {}, ['name']);
    if (missing.length) {
      return badRequest(res, `Missing required fields: ${missing.join(', ')}`);
    }
    const result = await restaurantClient.createOptionGroup(restaurantId, productId, req.body, req);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createCombo(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const missing = ensureFields(req.body || {}, ['name', 'basePrice']);
    if (missing.length) {
      return badRequest(res, `Missing required fields: ${missing.join(', ')}`);
    }
    const result = await restaurantClient.createCombo(restaurantId, req.body, req);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createPromotion(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return badRequest(res, 'restaurantId is required');
    }
    const missing = ensureFields(req.body || {}, ['name', 'promoType', 'discountType', 'discountValue']);
    if (missing.length) {
      return badRequest(res, `Missing required fields: ${missing.join(', ')}`);
    }
    const result = await restaurantClient.createPromotion(restaurantId, req.body, req);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listRestaurantProducts(req, res, next) {
  try {
    const result = await restaurantClient.listRestaurantProducts(req.params.id, req.query, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function createRestaurantProduct(req, res, next) {
  try {
    const result = await restaurantClient.createRestaurantProduct(req.params.id, req.body, req);
    return res.status(201).json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function updateRestaurantProduct(req, res, next) {
  try {
    const result = await restaurantClient.updateRestaurantProduct(
      req.params.id,
      req.params.productId,
      req.body,
      req,
    );
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function deleteRestaurantProduct(req, res, next) {
  try {
    await restaurantClient.deleteRestaurantProduct(req.params.id, req.params.productId, req);
    return res.status(204).end();
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function listRestaurantInventory(req, res, next) {
  try {
    const result = await restaurantClient.listRestaurantInventory(req.params.id, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function listProductInventory(req, res, next) {
  try {
    const result = await restaurantClient.listProductInventory(
      req.params.id,
      req.params.productId,
      req,
    );
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function listBranchInventory(req, res, next) {
  try {
    const result = await restaurantClient.listBranchInventory(
      req.params.id,
      req.params.branchId,
      req,
    );
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function upsertBranchInventory(req, res, next) {
  try {
    const result = await restaurantClient.upsertBranchInventory(
      req.params.id,
      req.params.branchId,
      req.params.productId,
      req.body,
      req,
    );
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

module.exports = {
  ownerSignup,
  ownerVerify,
  ownerLogin,
  accountLogin,
  ownerStatus,
  resendVerification,
  listCatalog,
  getCatalog,
  getRestaurant,
  getRestaurantByOwner,
  listRestaurantsByOwner,
  createRestaurant,
  updateRestaurant,
  createBranch,
  listBranches,
  updateBranch,
  updateBranchSchedules,
  deleteBranch,
  inviteMember,
  listMembers,
  createCategory,
  listCategories,
  createProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  listInventory,
  updateInventory,
  createOptionGroup,
  createCombo,
  createPromotion,
};
