import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import adminOrdersService from "../../services/adminOrders";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivering", label: "Delivering" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_LABELS = STATUS_TABS.reduce((acc, tab) => {
  acc[tab.key] = tab.label;
  return acc;
}, {});

const formatCurrency = (amount, currency = "VND") => {
  const value = Number(amount || 0);
  return `${currency} ${value.toLocaleString()}`;
};

const toOrderModel = (order) => {
  if (!order) return null;
  const metadata =
    order.metadata && typeof order.metadata === "object" ? order.metadata : {};
  const restaurantName =
    metadata.restaurant_name ||
    metadata.restaurant_snapshot?.name ||
    order.restaurant_name ||
    order.restaurantName ||
    "Restaurant";
  const branchName =
    metadata.branch_name ||
    metadata.branch_snapshot?.name ||
    order.branch_name ||
    order.branchName ||
    "Branch";
  const address =
    order.delivery?.delivery_address ||
    order.delivery_address ||
    metadata.delivery_address ||
    metadata.shipping_address ||
    order.shipping_address_snapshot ||
    null;
  const customerProfile =
    order.customer_profile ||
    order.user_profile ||
    order.profile ||
    order.customer ||
    {};
  const items = Array.isArray(order.items) ? order.items : [];

  return {
    id: order.id,
    restaurantId: order.restaurant_id || order.restaurantId || null,
    restaurantName,
    branchId: order.branch_id || order.branchId || null,
    branchName,
    status: (order.status || "pending").toLowerCase(),
    paymentStatus: (order.payment_status || "").toLowerCase(),
    totalAmount: order.total_amount ?? order.totalAmount ?? 0,
    currency: order.currency || metadata.currency || "VND",
    createdAt: order.created_at || order.createdAt || null,
    customerName:
      metadata.customer_name ||
      metadata.customer ||
      customerProfile.full_name ||
      customerProfile.fullName ||
      [customerProfile.first_name, customerProfile.last_name].filter(Boolean).join(" ").trim() ||
      "Customer",
    customerPhone:
      metadata.customer_phone ||
      customerProfile.phone ||
      customerProfile.phone_number ||
      customerProfile.phoneNumber ||
      order.delivery?.contact_phone ||
      null,
    address,
    itemsCount: items.length,
  };
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({
    status: "all",
    restaurant: "all",
    branch: "all",
    search: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingMap, setUpdatingMap] = useState({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status !== "all") {
        params.status = filters.status;
      }
      const payload = await adminOrdersService.list(params);
      const list = Array.isArray(payload) ? payload : [];
      const normalized = list.map(toOrderModel).filter(Boolean);
      setOrders(normalized);
      setError("");
    } catch (err) {
      console.error("[admin-orders] failed to load orders", err);
      const message =
        err?.response?.data?.error ||
        err?.message ||
        "Unable to load orders. Please try again.";
      setError(message);
      setOrders([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [filters.status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const restaurants = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      if (!order.restaurantId) return;
      const id = String(order.restaurantId);
      if (!map.has(id)) {
        map.set(id, order.restaurantName || "Restaurant");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  const branches = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      if (!order.branchId) return;
      if (
        filters.restaurant !== "all" &&
        order.restaurantId &&
        String(order.restaurantId) !== String(filters.restaurant)
      ) {
        return;
      }
      const id = String(order.branchId);
      if (!map.has(id)) {
        map.set(id, {
          name: order.branchName || "Branch",
          restaurantId: order.restaurantId || null,
        });
      }
    });
    return Array.from(map.entries()).map(([id, value]) => ({
      id,
      name: value.name,
      restaurantId: value.restaurantId,
    }));
  }, [filters.restaurant, orders]);

  const scopedOrders = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return orders.filter((order) => {
      if (filters.restaurant !== "all") {
        if (!order.restaurantId || String(order.restaurantId) !== String(filters.restaurant)) {
          return false;
        }
      }

      if (filters.branch !== "all") {
        if (!order.branchId || String(order.branchId) !== String(filters.branch)) {
          return false;
        }
      }

      if (!keyword) return true;

      const fields = [
        order.id,
        order.customerName,
        order.customerPhone,
        order.restaurantName,
        order.branchName,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return fields.some((field) => field.includes(keyword));
    });
  }, [filters.branch, filters.restaurant, filters.search, orders]);

  const filteredOrders = useMemo(() => {
    if (filters.status === "all") return scopedOrders;
    return scopedOrders.filter((order) => order.status === filters.status);
  }, [filters.status, scopedOrders]);

  const handleStatusChange = async (order, nextStatusRaw) => {
    if (!order?.id) return;
    const nextStatus =
      typeof nextStatusRaw === "string" ? nextStatusRaw.trim().toLowerCase() : "";
    if (!nextStatus || nextStatus === order.status) return;

    setUpdatingMap((prev) => ({ ...prev, [order.id]: true }));
    try {
      const updated = await adminOrdersService.update(order.id, { status: nextStatus });
      setOrders((prev) =>
        prev.map((item) => (item.id === order.id ? toOrderModel(updated) || item : item)),
      );
      toast.success(`Order ${order.id.slice(0, 8)} status updated to ${STATUS_LABELS[nextStatus] || nextStatus}`);
    } catch (err) {
      console.error("[admin-orders] failed to update", err);
      const message =
        err?.response?.data?.error ||
        err?.message ||
        "Unable to update order status.";
      toast.error(message);
    } finally {
      setUpdatingMap((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    }
  };

  const handleCancel = async (order) => {
    if (!order?.id) return;
    const reason =
      typeof window !== "undefined"
        ? window.prompt("Reason for cancellation", "admin_cancel")
        : "admin_cancel";
    if (reason === null) return;

    setUpdatingMap((prev) => ({ ...prev, [order.id]: true }));
    try {
      const updated = await adminOrdersService.cancel(order.id, { reason: reason || "admin_cancel" });
      setOrders((prev) =>
        prev.map((item) => (item.id === order.id ? toOrderModel(updated) || item : item)),
      );
      toast.success(`Order ${order.id.slice(0, 8)} cancelled`);
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        "Unable to cancel order.";
      toast.error(message);
    } finally {
      setUpdatingMap((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Admin Order Management</h1>
          <p className="text-sm text-neutral-600">
            Review, filter, and moderate all orders across restaurants and branches.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={loadOrders}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? scopedOrders.length
                : scopedOrders.filter((order) => order.status === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, status: tab.key }))}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  filters.status === tab.key
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Restaurant
            <select
              value={filters.restaurant}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  restaurant: event.target.value,
                  branch: "all",
                }))
              }
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            >
              <option value="all">All restaurants</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Branch
            <select
              value={filters.branch}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, branch: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              disabled={!branches.length}
            >
              <option value="all">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Search
            <div className="relative mt-1">
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Order ID, customer, restaurant..."
                className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
                </svg>
              </span>
            </div>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-6 py-6 text-sm text-neutral-500">Loading orders...</p>
        ) : filteredOrders.length ? (
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-6 py-3 text-left">Order</th>
                <th className="px-6 py-3 text-left">Restaurant</th>
                <th className="px-6 py-3 text-left">Customer</th>
                <th className="px-6 py-3 text-left">Amount</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredOrders.map((order) => {
                const updating = Boolean(updatingMap[order.id]);
                return (
                  <tr key={order.id} className="hover:bg-neutral-50/70">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-neutral-900">{order.id}</p>
                      <p className="text-xs text-neutral-500">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString()
                          : "Unknown date"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-neutral-700">
                      <p className="font-semibold">{order.restaurantName}</p>
                      <p className="text-xs text-neutral-500">{order.branchName}</p>
                    </td>
                    <td className="px-6 py-4 text-neutral-700">
                      <p className="font-semibold">{order.customerName}</p>
                      <p className="text-xs text-neutral-500">
                        {order.customerPhone || "No phone"} • {order.itemsCount} items
                      </p>
                    </td>
                    <td className="px-6 py-4 text-neutral-900 font-semibold">
                      {formatCurrency(order.totalAmount, order.currency)}
                      <p className="text-xs text-neutral-500 capitalize">
                        {order.paymentStatus || "unpaid"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <select
                          value={order.status}
                          disabled={updating}
                          onChange={(event) => handleStatusChange(order, event.target.value)}
                          className="rounded-lg border border-neutral-200 bg-white py-2 px-3 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {STATUS_TABS.filter((tab) => tab.key !== "all").map((status) => (
                            <option key={status.key} value={status.key}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        {updating ? (
                          <svg
                            className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => handleCancel(order)}
                          disabled={updating}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-6 text-sm text-neutral-500">
            No orders match the current filters.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;
