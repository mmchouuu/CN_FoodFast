import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import adminService from "../../services/admin";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending admin" },
  { key: "awaiting", label: "Awaiting activation" },
  { key: "active", label: "Active" },
  { key: "warning", label: "Warning" },
  { key: "locked", label: "Locked" },
];

const matchStatusFilter = (restaurant, filterKey) => {
  switch (filterKey) {
    case "pending":
      return restaurant.restaurant_status === "pending";
    case "awaiting":
      return restaurant.restaurant_status === "approve";
    case "active":
      return restaurant.restaurant_status === "active";
    case "warning":
      return restaurant.restaurant_status === "warning";
    case "locked":
      return restaurant.restaurant_status === "approved";
    case "all":
    default:
      return true;
  }
};

const AdminRestaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminService.getRestaurants();
      setRestaurants(data || []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Unable to load restaurants.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const keyword = search.trim().toLowerCase();
    const matchesSearch = restaurants.filter((restaurant) => {
      if (!keyword) return true;
      const name = (restaurant.restaurant_name || "").toLowerCase();
      const manager = (restaurant.manager_name || "").toLowerCase();
      const email = (restaurant.email || "").toLowerCase();
      return name.includes(keyword) || manager.includes(keyword) || email.includes(keyword);
    });

    const filteredByStatus = matchesSearch.filter((restaurant) => matchStatusFilter(restaurant, statusFilter));
    setFiltered(filteredByStatus);
  }, [restaurants, search, statusFilter]);

  const pendingCount = useMemo(
    () => restaurants.filter((restaurant) => restaurant.restaurant_status === "pending").length,
    [restaurants],
  );

  const handleApprove = async (id) => {
    try {
      await adminService.approveRestaurant(id);
      toast.success("Restaurant approved. Credentials sent.");
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Unable to approve restaurant.");
    }
  };

  const handleModeration = async (restaurant, action) => {
    try {
      await adminService.updateUserActiveStatus(restaurant.id, action);
      const messages = {
        lock: "Restaurant locked.",
        warning: "Restaurant marked with a warning.",
        active: "Restaurant activated.",
      };
      toast.success(messages[action] || "Status updated.");
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Unable to update restaurant status.");
    }
  };

  const handleView = async (id) => {
    setDetailLoading(true);
    try {
      const detail = await adminService.getUserDetails(id);
      setSelected(detail);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Unable to fetch restaurant details.");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Restaurant Management</h1>
          <p className="text-sm text-neutral-600">
            Monitor onboarding progress, send credentials, and moderate restaurant accounts.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <span>
            Pending approvals:{" "}
            <span className="font-semibold text-neutral-800">
              {pendingCount}/{restaurants.length}
            </span>
          </span>
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  statusFilter === filter.key
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by restaurant, manager, or email"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>
          {error ? <p className="text-xs text-rose-500">{error}</p> : null}
        </div>
        <RestaurantTable
          loading={loading}
          restaurants={filtered}
          onApprove={handleApprove}
          onModerate={handleModeration}
          onView={handleView}
        />
      </div>

      <RestaurantDetailCard detail={selected} loading={detailLoading} />
    </div>
  );
};

const RestaurantTable = ({ loading, restaurants, onApprove, onModerate, onView }) => {
  if (loading) {
    return <p className="px-6 py-6 text-sm text-neutral-500">Loading restaurants...</p>;
  }

  if (!restaurants.length) {
    return <p className="px-6 py-6 text-sm text-neutral-500">No restaurants found.</p>;
  }

  return (
    <table className="min-w-full divide-y divide-neutral-200 text-sm">
      <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <tr>
          <th className="px-6 py-3">Restaurant</th>
          <th className="px-6 py-3">Contact</th>
          <th className="px-6 py-3">Manager</th>
          <th className="px-6 py-3">Status</th>
          <th className="px-6 py-3">Approval</th>
          <th className="px-6 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-200">
        {restaurants.map((restaurant) => (
          <tr key={restaurant.id} className="hover:bg-neutral-50/80">
            <td className="px-6 py-4">
              <p className="font-semibold text-neutral-800">{restaurant.restaurant_name || "Unnamed restaurant"}</p>
              <p className="text-xs text-neutral-500">{restaurant.id}</p>
            </td>
            <td className="px-6 py-4 text-neutral-600">
              <div>{restaurant.email || "No email"}</div>
              <div className="text-xs text-neutral-500">{restaurant.phone || "No hotline"}</div>
            </td>
            <td className="px-6 py-4 text-neutral-600">
              {restaurant.manager_name || formatName(restaurant.first_name, restaurant.last_name)}
            </td>
            <td className="px-6 py-4">
              <AccountStatusBadge restaurant={restaurant} />
            </td>
            <td className="px-6 py-4">
              <ApprovalStatusBadge restaurant={restaurant} />
            </td>
            <td className="px-6 py-4 text-right">
              <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-semibold text-neutral-600">
                {restaurant.restaurant_status === "pending" ? (
                  <button
                    onClick={() => onApprove(restaurant.id)}
                    className="text-emerald-600 transition hover:text-emerald-700"
                  >
                    Approve
                  </button>
                ) : (
                  <>
                    <ModerationButton
                      label="Activate"
                      onClick={() => onModerate(restaurant, "active")}
                      disabled={
                        restaurant.is_active && (restaurant.restaurant_status === "active" || restaurant.restaurant_status === "warning")
                      }
                      className="text-emerald-600 hover:text-emerald-700"
                    />
                    <ModerationButton
                      label="Warning"
                      onClick={() => onModerate(restaurant, "warning")}
                      disabled={restaurant.restaurant_status === "warning"}
                      className="text-amber-600 hover:text-amber-700"
                    />
                    <ModerationButton
                      label="Lock"
                      onClick={() => onModerate(restaurant, "lock")}
                      disabled={!restaurant.is_active && restaurant.restaurant_status === "approved"}
                      className="text-rose-600 hover:text-rose-700"
                    />
                  </>
                )}
                <button onClick={() => onView(restaurant.id)} className="text-neutral-600 transition hover:text-neutral-900">
                  View
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ModerationButton = ({ label, onClick, disabled, className }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`${className} ${disabled ? "cursor-not-allowed opacity-50" : "transition"}`}
  >
    {label}
  </button>
);

const AccountStatusBadge = ({ restaurant }) => {
  if (restaurant.restaurant_status === "warning") {
    return <Badge color="bg-amber-100 text-amber-700">Warning</Badge>;
  }
  if (restaurant.is_active) {
    return <Badge color="bg-emerald-100 text-emerald-700">Active</Badge>;
  }
  return <Badge color="bg-rose-100 text-rose-700">Locked</Badge>;
};

const ApprovalStatusBadge = ({ restaurant }) => {
  const status = restaurant.restaurant_status;
  if (status === "pending") {
    return <Badge color="bg-amber-100 text-amber-700">Pending admin review</Badge>;
  }
  if (status === "approve") {
    return <Badge color="bg-sky-100 text-sky-700">Awaiting activation</Badge>;
  }
  if (status === "approved") {
    return <Badge color="bg-rose-100 text-rose-700">Locked</Badge>;
  }
  if (status === "active") {
    return <Badge color="bg-emerald-100 text-emerald-700">Active</Badge>;
  }
  if (status === "warning") {
    return <Badge color="bg-amber-100 text-amber-700">Warning</Badge>;
  }
  if (status === "not_found") {
    return <Badge color="bg-neutral-200 text-neutral-600">Not found</Badge>;
  }
  return <Badge color="bg-neutral-200 text-neutral-600">Unknown</Badge>;
};

const RestaurantDetailCard = ({ detail, loading }) => {
  if (loading) {
    return <p className="text-sm text-neutral-500">Loading restaurant details...</p>;
  }
  if (!detail) return null;

  const { user, addresses = [] } = detail;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{user.restaurant_name || "Restaurant detail"}</h2>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{user.role}</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoField label="Manager" value={user.manager_name || formatName(user.first_name, user.last_name)} />
        <InfoField label="Status" value={formatAccountStatus(user)} />
        <InfoField label="Approval" value={formatApprovalStatus(user.restaurant_status)} />
        <InfoField label="Tier" value={user.tier || "Bronze"} />
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Addresses</p>
        {addresses.length ? (
          <ul className="mt-2 space-y-1 text-sm text-neutral-600">
            {addresses.map((address) => (
              <li key={address.id}>
                {address.street}, {address.ward}, {address.district}, {address.city}{" "}
                {address.is_primary ? "(Primary)" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">No addresses on file.</p>
        )}
      </div>
    </div>
  );
};

const Badge = ({ color, children }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
    {children}
  </span>
);

const InfoField = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
    <p className="mt-1 text-sm text-neutral-700">{value || "-"}</p>
  </div>
);

const formatName = (firstName, lastName) => {
  const full = `${firstName || ""} ${lastName || ""}`.trim();
  return full || "No manager";
};

const formatAccountStatus = (restaurant) => {
  if (restaurant.restaurant_status === "warning") {
    return "Warning";
  }
  return restaurant.is_active ? "Active" : "Locked";
};

const formatApprovalStatus = (status) => {
  switch (status) {
    case "pending":
      return "Pending";
    case "approve":
      return "Awaiting";
    case "approved":
      return "Approved";
    case "active":
      return "Active";
    case "warning":
      return "Warning";
    default:
      return "Unknown";
  }
};

export default AdminRestaurants;
