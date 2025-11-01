function toRoleArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((role) => (typeof role === 'string' ? role.trim().toLowerCase() : null))
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim().length) {
    return value
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

module.exports = function requireRoles(roles) {
  const allowed =
    Array.isArray(roles) && roles.length
      ? new Set(
          roles
            .map((role) => (typeof role === 'string' ? role.trim().toLowerCase() : null))
            .filter(Boolean),
        )
      : null;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthenticated' });
    }

    if (!allowed || allowed.size === 0) {
      return next();
    }

    const userRoles = new Set([
      ...toRoleArray(req.user.role),
      ...toRoleArray(req.user.roles),
      ...toRoleArray(req.user.permissions),
    ]);

    const hasRole = Array.from(allowed).some((role) => userRoles.has(role));

    if (!hasRole) {
      return res.status(403).json({ error: 'forbidden' });
    }

    return next();
  };
};
