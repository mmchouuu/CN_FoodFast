import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import useOwnerPermission from "../../hooks/useOwnerPermission";

const ROLE_LABELS = {
  owner_main: "Owner Main",
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

const buildBadges = (profile = {}, role = null) => {
  const badges = [];
  const isActive = profile.isActive ?? profile.is_active ?? true;
  badges.push(
    isActive
      ? { label: "Active", className: "bg-emerald-100 text-emerald-600" }
      : { label: "Inactive", className: "bg-rose-100 text-rose-600" },
  );

  if (role) {
    badges.push({
      label: ROLE_LABELS[role] || role,
      className: "bg-slate-100 text-slate-600",
    });

  }
  return badges;
};

const OwnerHeader = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { restaurantProfile, logoutOwner } = useAppContext();
  const { role } = useOwnerPermission();

  const {
    initials,
    ownerName,
    restaurantName,
    badges,
    branchLabel,
  } = useMemo(() => {
    if (!restaurantProfile) {
      return {
        initials: "?",
        ownerName: "Restaurant owner",
        restaurantName: "No restaurant profile",
        badges: [],
        branchLabel: "",
      };
    }

    const rawManager = restaurantProfile.managerName ?? restaurantProfile.manager_name ?? "";
    const rawRestaurant = restaurantProfile.restaurantName ?? restaurantProfile.restaurant_name ?? "";
    const rawFullName = restaurantProfile.fullName ?? restaurantProfile.full_name ?? "";
    const email = restaurantProfile.email ?? restaurantProfile.email_address ?? "";

    const displayName = rawManager || rawFullName || email || "Restaurant owner";
    const displayRestaurant = rawRestaurant || "Restaurant profile not completed";
    const badgeList = buildBadges(restaurantProfile, role);

    const computedInitials =
      displayName
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase())
        .slice(0, 2)
        .join("") || "RO";

    return {
      initials: computedInitials,
      ownerName: displayName,
      restaurantName: displayRestaurant,
      badges: badgeList,
      branchLabel:
        restaurantProfile.branchName ||
        (restaurantProfile.branchId ? `Branch #${restaurantProfile.branchId}` : ""),
    };
  }, [restaurantProfile, role]);

  const handleLogout = () => {
    if (typeof logoutOwner === "function") {
      logoutOwner();
    }
    navigate("/restaurant/auth/login", { replace: true });
  };

  return (
    <section className="mb border bg-white border-white p-3 shadow-sm md">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* LEFT: Menu toggle (mobile) + Owner Avatar + Name + Restaurant */}
        <div className="flex items-start gap-3">
          {typeof onMenuToggle === 'function' && (
            <button
              type="button"
              onClick={onMenuToggle}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 md:hidden"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menu
            </button>
          )}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-base font-semibold text-white md:h-14 md:w-14 md:text-lg">
            {initials}
          </div>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">{ownerName}</h2>
            <p className="text-sm text-slate-600">{restaurantName}</p>
          </div>
        </div>

        {/* RIGHT: Branch label + Badges + Logout */}
        <div className="flex flex-col items-start gap-2 md:items-end">

          {/* Branch Label (nếu có) */}
          {branchLabel ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {branchLabel}
            </p>
          ) : null}

          {/* Badges */}
          {badges.length ? (
            <div className="flex flex-wrap gap-2 md:justify-end">
              {badges.map((badge) => (
                <span
                  key={`${badge.label}`}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 md:text-sm"
          >
            Log out
          </button>

        </div>
      </div>
    </section>
  );
};

export default OwnerHeader;
