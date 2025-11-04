function normalizeRoles(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((role) => (typeof role === 'string' ? role.trim().toLowerCase() : null))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

module.exports = function requireRoles(required) {
  const allowed =
    Array.isArray(required) && required.length
      ? new Set(required.map((role) => role.trim().toLowerCase()))
      : null;

  return (req, res, next) => {
    if (!allowed || !allowed.size) {
      return next();
    }
    const user = req.user || {};
    const userRoles = new Set([
      ...normalizeRoles(user.role),
      ...normalizeRoles(user.roles),
      ...normalizeRoles(user.permissions),
    ]);
    const ok = Array.from(allowed).some((role) => userRoles.has(role));
    if (!ok) {
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  };
};
