import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import adminService from "../../services/admin";
import restaurantManagerService from "../../services/restaurantManager";

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
  const createBranchForm = useCallback(
    (restaurantId = "") => ({
      restaurantId: restaurantId ? String(restaurantId) : "",
      branchId: null,
      name: "",
      street: "",
      district: "",
      city: "",
      phone: "",
      email: "",
      isOpen: true,
    }),
    [],
  );

  const [restaurants, setRestaurants] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRestaurantProfile, setSelectedRestaurantProfile] = useState(null);
  const [ownerRestaurants, setOwnerRestaurants] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchForm, setBranchForm] = useState(() => createBranchForm());
  const [branchSaving, setBranchSaving] = useState(false);
  const [activeOwnerId, setActiveOwnerId] = useState(null);
  const detailRef = useRef(null);

  const resetBranchForm = useCallback(
    (restaurantId = null) => {
      setBranchForm((prev) =>
        createBranchForm(restaurantId ?? prev.restaurantId),
      );
    },
    [createBranchForm],
  );

  const loadOwnerRestaurants = useCallback(
    async (ownerId) => {
      if (!ownerId) {
        setOwnerRestaurants([]);
        resetBranchForm();
        return [];
      }
      setBranchesLoading(true);
      try {
        const data = await restaurantManagerService.listByOwner(ownerId);
        const list = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];
        setOwnerRestaurants(list);
        if (list.length) {
          setBranchForm((prev) => {
            const targetRestaurantId = prev.restaurantId || list[0].id || "";
            return createBranchForm(targetRestaurantId);
          });
        } else {
          resetBranchForm();
        }
        return list;
      } catch (err) {
        console.error("[admin-restaurants] failed to load owner restaurants", err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Unable to load restaurant branches.";
        toast.error(message);
        setOwnerRestaurants([]);
        resetBranchForm();
        return [];
      } finally {
        setBranchesLoading(false);
      }
    },
    [createBranchForm, resetBranchForm],
  );

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

  const handleView = async (restaurant) => {
    const target = restaurant || {};
    const ownerId = target.id || target.owner_id || target.ownerId || null;
    // Show the basic record immediately while fetching richer details
    setSelected({ user: target, addresses: [] });
    setSelectedRestaurantProfile(null);
    setTimeout(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 10);
    setDetailLoading(true);
    setActiveOwnerId(ownerId);
    try {
      const [detail, restaurants] = await Promise.all([
        ownerId ? adminService.getUserDetails(ownerId) : null,
        loadOwnerRestaurants(ownerId),
      ]);

      const targetRestaurantId =
        target.restaurant_id || target.restaurantId || target.restaurant_id || null;

      const resolvedRestaurant =
        (restaurants || []).find(
          (item) => targetRestaurantId && String(item.id) === String(targetRestaurantId),
        ) || (restaurants || [])[0] || null;

      if (detail) {
        const mergedUser = { ...(detail.user || {}), ...target };
        setSelected({ ...detail, user: mergedUser });
      } else {
        setSelected({ user: target, addresses: [] });
      }

      setSelectedRestaurantProfile(resolvedRestaurant);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Unable to fetch restaurant details.");
      setSelected({ user: target, addresses: [] });
      setSelectedRestaurantProfile(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBranchFieldChange = (field, value) => {
    setBranchForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBranchSubmit = async (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (!branchForm.restaurantId) {
      toast.error("Select a restaurant before adding a branch.");
      return;
    }
    if (!branchForm.street.trim()) {
      toast.error("Branch street is required.");
      return;
    }
    const payload = {
      name: branchForm.name || null,
      street: branchForm.street,
      district: branchForm.district || null,
      city: branchForm.city || null,
      branchPhone: branchForm.phone || null,
      branchEmail: branchForm.email || null,
      isOpen: branchForm.isOpen,
    };
    setBranchSaving(true);
    try {
      if (branchForm.branchId) {
        await restaurantManagerService.updateBranch(
          branchForm.restaurantId,
          branchForm.branchId,
          payload,
        );
        toast.success("Branch updated.");
      } else {
        await restaurantManagerService.createBranch(branchForm.restaurantId, payload);
        toast.success("Branch created.");
      }
      await loadOwnerRestaurants(activeOwnerId);
      resetBranchForm(branchForm.restaurantId);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to save branch. Please try again.";
      toast.error(message);
    } finally {
      setBranchSaving(false);
    }
  };

  const startBranchEdit = (restaurantId, branch) => {
    if (!branch) return;
    setBranchForm({
      restaurantId,
      branchId: branch.id,
      name: branch.name || "",
      street: branch.street || "",
      district: branch.district || "",
      city: branch.city || "",
      phone: branch.branchPhone || branch.phone || "",
      email: branch.branchEmail || branch.email || "",
      isOpen: branch.is_open ?? branch.isOpen ?? true,
    });
  };

  const handleDeleteBranch = async (restaurantId, branchId) => {
    if (!restaurantId || !branchId) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this branch?");
      if (!confirmed) return;
    }
    setBranchSaving(true);
    try {
      await restaurantManagerService.deleteBranch(restaurantId, branchId);
      toast.success("Branch deleted.");
      await loadOwnerRestaurants(activeOwnerId);
      resetBranchForm(restaurantId);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to delete branch.";
      toast.error(message);
    } finally {
      setBranchSaving(false);
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

      <div ref={detailRef} className="space-y-4">
        <RestaurantDetailCard
          detail={selected}
          restaurant={selectedRestaurantProfile}
          loading={detailLoading}
        />
        {selectedRestaurantProfile ? (
          <RestaurantBranchList restaurant={selectedRestaurantProfile} loading={branchesLoading} />
        ) : null}
      </div>
      {selected ? (
        <BranchManagementPanel
          restaurants={ownerRestaurants}
          loading={branchesLoading}
          form={branchForm}
          saving={branchSaving}
          onFieldChange={handleBranchFieldChange}
          onSubmit={handleBranchSubmit}
          onReset={(restaurantId) => resetBranchForm(restaurantId ?? ownerRestaurants[0]?.id)}
          onEditBranch={startBranchEdit}
          onDeleteBranch={handleDeleteBranch}
        />
      ) : null}
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
                <button
                  type="button"
                  onClick={() => onView(restaurant)}
                  className="text-neutral-600 transition hover:text-neutral-900"
                >
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

const BranchManagementPanel = ({
  restaurants,
  loading,
  form,
  saving,
  onFieldChange,
  onSubmit,
  onReset,
  onEditBranch,
  onDeleteBranch,
}) => {
  const restaurantOptions = Array.isArray(restaurants) ? restaurants : [];
  const selectedRestaurant =
    restaurantOptions.find((restaurant) => String(restaurant.id) === String(form.restaurantId)) ||
    restaurantOptions[0] ||
    null;
  const branchCount = restaurantOptions.reduce(
    (acc, restaurant) => acc + (Array.isArray(restaurant?.branches) ? restaurant.branches.length : 0),
    0,
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Branch Management</h2>
          <p className="text-sm text-neutral-600">
            Create, edit, or remove branches for this owner&apos;s restaurants.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          <span>
            {restaurantOptions.length} restaurants • {branchCount} branches
          </span>
          <button
            type="button"
            onClick={() => onReset(selectedRestaurant?.id)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-900"
          >
            New branch
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading branches...</p>
      ) : !restaurantOptions.length ? (
        <p className="text-sm text-neutral-500">Select a restaurant record to manage branches.</p>
      ) : (
        <div className="space-y-3">
          {restaurantOptions.map((restaurant) => {
            const branches = Array.isArray(restaurant.branches) ? restaurant.branches : [];
            return (
              <div key={restaurant.id} className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {restaurant.name || restaurant.legalName || restaurant.restaurant_name || "Restaurant"}
                    </p>
                    <p className="text-xs text-neutral-500">{branches.length} branch(es)</p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => onReset(restaurant.id)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-600 hover:text-neutral-900"
                    >
                      Add branch
                    </button>
                    <button
                      type="button"
                      onClick={() => onReset(restaurant.id)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-600 hover:text-neutral-900"
                    >
                      Manage here
                    </button>
                  </div>
                </div>
                {branches.length ? (
                  <ul className="mt-3 divide-y divide-neutral-200">
                    {branches.map((branch) => (
                      <li key={branch.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-neutral-900">{branch.name || "Branch"}</p>
                          <p className="text-xs text-neutral-500">
                            {[branch.street, branch.district, branch.city].filter(Boolean).join(", ") || "No address"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span
                            className={`rounded-full px-3 py-1 ${
                              branch.isOpen || branch.is_open
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {branch.isOpen || branch.is_open ? "Open" : "Closed"}
                          </span>
                          <button
                            type="button"
                            onClick={() => onEditBranch(restaurant.id, branch)}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-600 hover:text-neutral-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBranch(restaurant.id, branch.id)}
                            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-rose-600 hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">No branches yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Restaurant
            <select
              value={form.restaurantId}
              onChange={(event) => onFieldChange("restaurantId", event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            >
              <option value="">Select a restaurant</option>
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name || restaurant.legalName || restaurant.restaurant_name || "Restaurant"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Branch name
            <input
              type="text"
              value={form.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              placeholder="e.g. District 1"
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Street (required)
            <input
              type="text"
              value={form.street}
              onChange={(event) => onFieldChange("street", event.target.value)}
              placeholder="123 Main St"
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              District
              <input
                type="text"
                value={form.district}
                onChange={(event) => onFieldChange("district", event.target.value)}
                placeholder="District"
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              City
              <input
                type="text"
                value={form.city}
                onChange={(event) => onFieldChange("city", event.target.value)}
                placeholder="City"
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Phone
            <input
              type="text"
              value={form.phone}
              onChange={(event) => onFieldChange("phone", event.target.value)}
              placeholder="Branch phone"
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
              placeholder="Branch email"
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <input
              type="checkbox"
              checked={form.isOpen}
              onChange={(event) => onFieldChange("isOpen", event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20"
            />
            <span>Branch open</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {form.branchId ? "Update branch" : "Create branch"}
          </button>
          <button
            type="button"
            onClick={() => onReset(form.restaurantId)}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-neutral-700 hover:text-neutral-900"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
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

const RestaurantDetailCard = ({ detail, restaurant, loading }) => {
  if (loading) {
    return <p className="text-sm text-neutral-500">Loading restaurant details...</p>;
  }
  if (!detail) return null;

  const { user, addresses = [] } = detail;
  const restaurantData = restaurant || {};
  const restaurantName =
    restaurantData.name ||
    restaurantData.legalName ||
    restaurantData.restaurant_name ||
    user.restaurant_name ||
    user.restaurantName ||
    user.legal_name ||
    user.legalName ||
    "Restaurant detail";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{restaurantName}</h2>
          <p className="text-sm text-neutral-600">{restaurantData.email || user.email}</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{user.role}</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoField label="Manager" value={restaurantData.manager_name || user.manager_name || formatName(user.first_name, user.last_name)} />
        <InfoField label="Status" value={formatAccountStatus(user)} />
        <InfoField label="Approval" value={formatApprovalStatus(user.restaurant_status)} />
        <InfoField label="Phone" value={restaurantData.phone || user.phone || "-"} />
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

const RestaurantBranchList = ({ restaurant, loading }) => {
  if (loading) {
    return <p className="text-sm text-neutral-500">Loading branches...</p>;
  }
  if (!restaurant) {
    return null;
  }
  const branches = Array.isArray(restaurant.branches) ? restaurant.branches : [];
  const restaurantName =
    restaurant.name ||
    restaurant.legalName ||
    restaurant.restaurant_name ||
    "Restaurant";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Branches</h2>
          <p className="text-sm text-neutral-600">Branches for {restaurantName}.</p>
        </div>
      </div>
      {branches.length ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-4">
            <ul className="divide-y divide-neutral-200">
              {branches.map((branch) => (
                <li key={branch.id} className="py-2">
                  <p className="font-semibold text-neutral-800">{branch.name || "Branch"}</p>
                  <p className="text-xs text-neutral-500">
                    {[branch.street, branch.district, branch.city].filter(Boolean).join(", ") || "No address"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 mt-2">No branches found.</p>
      )}
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
