import React from "react";
import useOwnerPermission from "../../hooks/useOwnerPermission";

const DefaultFallback = ({ message }) => (
  <div className="rounded-2xl border border-orange-100 bg-orange-50 p-6 text-sm text-orange-800">
    <p className="font-semibold">Permission required</p>
    <p className="mt-2">{message || "Your current role does not have access to this section."}</p>
  </div>
);

const OwnerPermissionGate = ({
  roles,
  permissions,
  fallback = null,
  message,
  children,
}) => {
  const { hasRequirement } = useOwnerPermission();
  const allowed = hasRequirement({ roles, permissions });

  if (!allowed) {
    if (fallback) {
      return typeof fallback === "function" ? fallback() : fallback;
    }
    return <DefaultFallback message={message} />;
  }

  return <>{children}</>;
};

export default OwnerPermissionGate;
