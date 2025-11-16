import { useMemo } from "react";
import { useAppContext } from "../context/AppContext";

const DEFAULT_PERMISSIONS = {
  canManageBranch: false,
  canManageMenu: false,
  canManageOrders: false,
  canManageFinance: false,
  canManageStaff: false,
};

const normalizeRequirement = (input) => {
  if (!input) return null;
  if (typeof input === "string") {
    return { permissions: [input] };
  }
  return {
    permissions: Array.isArray(input.permissions) ? input.permissions : [],
    roles: Array.isArray(input.roles) ? input.roles : [],
  };
};

const useOwnerPermission = () => {
  const { restaurantProfile } = useAppContext();
  const role = restaurantProfile?.role || (restaurantProfile ? "owner_main" : null);
  const permissions = useMemo(() => {
    if (!restaurantProfile) return { ...DEFAULT_PERMISSIONS };
    if (role === "owner_main") {
      return {
        canManageBranch: true,
        canManageMenu: true,
        canManageOrders: true,
        canManageFinance: true,
        canManageStaff: true,
      };
    }
    const source = restaurantProfile.permissions || {};
    return {
      canManageBranch: Boolean(source.canManageBranch),
      canManageMenu: Boolean(source.canManageMenu),
      canManageOrders: Boolean(source.canManageOrders),
      canManageFinance: Boolean(source.canManageFinance),
      canManageStaff: Boolean(source.canManageStaff),
    };
  }, [restaurantProfile, role]);

  const scope = useMemo(() => {
    if (!restaurantProfile?.scope) {
      return { restaurantIds: [], branchIds: [] };
    }
    return {
      restaurantIds: Array.isArray(restaurantProfile.scope.restaurantIds)
        ? restaurantProfile.scope.restaurantIds
        : [],
      branchIds: Array.isArray(restaurantProfile.scope.branchIds)
        ? restaurantProfile.scope.branchIds
        : [],
    };
  }, [restaurantProfile]);

  const hasRequirement = (requirement) => {
    if (!requirement) return Boolean(restaurantProfile);
    const normalized = normalizeRequirement(requirement);
    if (!normalized) return Boolean(restaurantProfile);

    if (normalized.roles?.length) {
      if (!role || !normalized.roles.includes(role)) {
        return false;
      }
    }

    if (normalized.permissions?.length) {
      const missing = normalized.permissions.some((key) => !permissions[key]);
      if (missing) return false;
    }

    return Boolean(restaurantProfile);
  };

  return {
    role,
    permissions,
    scope,
    hasRequirement,
  };
};

export default useOwnerPermission;
