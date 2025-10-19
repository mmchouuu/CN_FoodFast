import React, { useMemo } from "react";
import { useAppContext } from "../../context/AppContext";

const buildBadges = (profile = {}) => {
  const isActive = profile.isActive ?? profile.is_active;
  if (isActive) {
    return [{ label: "Active", className: "bg-emerald-100 text-emerald-600" }];
  }
  if (isActive === false) {
    return [{ label: "Inactive", className: "bg-rose-100 text-rose-600" }];
  }
  return [];
};

const OwnerHeader = () => {
  const { restaurantProfile } = useAppContext();

  const {
    initials,
    ownerName,
    restaurantName,
    badges,
  } = useMemo(() => {
    if (!restaurantProfile) {
      return {
        initials: "?",
        ownerName: "Restaurant owner",
        restaurantName: "No restaurant profile",
        badges: [],
      };
    }

    const rawManager = restaurantProfile.managerName ?? restaurantProfile.manager_name ?? "";
    const rawRestaurant = restaurantProfile.restaurantName ?? restaurantProfile.restaurant_name ?? "";
    const rawFullName = restaurantProfile.fullName ?? restaurantProfile.full_name ?? "";
    const email = restaurantProfile.email ?? restaurantProfile.email_address ?? "";

    const displayName = rawManager || rawFullName || email || "Restaurant owner";
    const displayRestaurant = rawRestaurant || "Restaurant profile not completed";
    const badgeList = buildBadges(restaurantProfile);

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
    };
  }, [restaurantProfile]);

  return (
    <section className="mb border bg-white border-white p-3 shadow-sm md">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-base font-semibold text-white md:h-14 md:w-14 md:text-lg">
            {initials}
          </div>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">{ownerName}</h2>
            <p className="text-sm text-slate-600">{restaurantName}</p>
          </div>
        </div>

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
      </div>
    </section>

  );
};

export default OwnerHeader;
