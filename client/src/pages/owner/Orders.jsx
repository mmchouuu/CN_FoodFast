import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext, adaptOrderFromApi } from "../../context/AppContext";
import ordersService from "../../services/orders";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const ORDER_STATUS_TABS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivering", label: "Delivering" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const resolveItemPrice = (item) => {
  if (!item) return 0;
  if (typeof item.price === "number") return item.price;
  const unit = Number(item.unitPrice ?? item.unit_price) || 0;
  const quantity = Number(item.quantity) || 1;
  return unit * quantity;
};

const Orders = () => {
  const { currency } = useAppContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(ORDER_STATUS_TABS[0].key);
  const [searchValue, setSearchValue] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ordersService.listOwnerOrders();
      const rawList = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      const adapted = rawList.map(adaptOrderFromApi).filter(Boolean);
      setOrders(adapted);
      setError(null);
    } catch (err) {
      console.error("[owner-orders] failed to load orders", err);
      const message =
        err?.response?.data?.error || err?.message || "Failed to load orders.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const restaurantOptions = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      if (!order.restaurantId) return;
      if (map.has(order.restaurantId)) return;
      map.set(order.restaurantId, {
        id: order.restaurantId,
        name: order.restaurantDisplayName || order.restaurantName || "Restaurant",
      });
    });
    return Array.from(map.values());
  }, [orders]);

  const branchOptions = useMemo(() => {
    const map = new Map();
    orders
      .filter(
        (order) =>
          selectedRestaurantId === "all" ||
          order.restaurantId === selectedRestaurantId,
      )
      .forEach((order) => {
        if (!order.branchId || map.has(order.branchId)) return;
        map.set(order.branchId, {
          id: order.branchId,
          name: order.branchName || "Branch",
          restaurantId: order.restaurantId,
        });
      });
    return Array.from(map.values());
  }, [orders, selectedRestaurantId]);

  useEffect(() => {
    if (
      selectedRestaurantId !== "all" &&
      !restaurantOptions.some((item) => item.id === selectedRestaurantId)
    ) {
      setSelectedRestaurantId("all");
    }
  }, [selectedRestaurantId, restaurantOptions]);

  useEffect(() => {
    if (selectedBranchId === "all") return;
    if (!branchOptions.some((item) => item.id === selectedBranchId)) {
      setSelectedBranchId("all");
    }
  }, [selectedBranchId, branchOptions]);

  const ordersFilteredByLocation = useMemo(() => {
    return orders.filter((order) => {
      const matchesRestaurant =
        selectedRestaurantId === "all" || order.restaurantId === selectedRestaurantId;
      const matchesBranch =
        selectedBranchId === "all" || order.branchId === selectedBranchId;
      return matchesRestaurant && matchesBranch;
    });
  }, [orders, selectedBranchId, selectedRestaurantId]);

  const statusCounts = useMemo(() => {
    const counts = ORDER_STATUS_TABS.reduce(
      (acc, tab) => ({ ...acc, [tab.key]: 0 }),
      {},
    );
    ordersFilteredByLocation.forEach((order) => {
      const key = (order.status || "").toLowerCase();
      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });
    return counts;
  }, [ordersFilteredByLocation]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return ordersFilteredByLocation.filter((order) => {
      const orderStatus = (order.status || "").toLowerCase();
      if (orderStatus !== activeTab) return false;
      if (!normalizedSearch) return true;
      const address = order.deliveryAddress || {};
      const recipient = `${address.recipient || ""} ${address.name || ""}`.toLowerCase();
      return (
        order.id.toLowerCase().includes(normalizedSearch) ||
        recipient.includes(normalizedSearch)
      );
    });
  }, [activeTab, ordersFilteredByLocation, searchValue]);

  const handleStatusChange = useCallback(
    async (orderId, status) => {
      try {
        await ordersService.updateOwnerOrderStatus(orderId, { status });
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status } : order,
          ),
        );
        toast.success("Order status updated.");
      } catch (err) {
        console.error("[owner-orders] failed to update status", err);
        const message =
          err?.response?.data?.error || err?.message || "Failed to update order status.";
        toast.error(message);
      }
    },
    [],
  );

  return (
    <div className="space-y-6">
      <header className={containerClasses}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Branch orders
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor incoming orders across your branches and update their status in real time.
            </p>
          </div>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Restaurant
            </label>
            <select
              value={selectedRestaurantId}
              onChange={(event) => setSelectedRestaurantId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              <option value="all">All restaurants</option>
              {restaurantOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Branch
            </label>
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              <option value="all">All branches</option>
              {branchOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                🔍
              </span>
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search order ID or recipient"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
          </div>
        </div>
      </header>

      <nav className={`${containerClasses} overflow-x-auto`}>
        <ul className="flex flex-wrap gap-3">
          {ORDER_STATUS_TABS.map((tab) => {
            const count = statusCounts[tab.key] || 0;
            return (
              <li key={tab.key}>
                <button
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label} ({count})
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {loading ? (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading orders…
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white p-10 text-center text-red-500 shadow-sm">
          {error}
        </div>
      ) : (
        <section className="space-y-4">
          {filteredOrders.map((order) => {
            const address = order.deliveryAddress || {};
            const customerName = address.recipient || address.name || "Customer";
            return (
              <article
                key={order.id}
                className="bg-white rounded-xl shadow-sm border border-slate-100"
              >
                <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-100 px-6 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Order #{order.id}
                    </p>
                    <p className="text-xs font-semibold text-emerald-600">
                      {order.restaurantDisplayName || order.restaurantName || "Restaurant"}
                    </p>
                    <p className="text-sm text-slate-500">
                      Placed on{" "}
                      {new Date(order.placedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    {order.branchName ? (
                      <p className="text-xs text-slate-400">
                        Branch: {order.branchName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <StatusSelect
                      defaultValue={(order.status || "pending").toLowerCase()}
                      onChange={(value) => handleStatusChange(order.id, value)}
                    />
                    <PaymentStatus
                      paid={["paid", "succeeded"].includes(
                        (order.paymentStatus || "").toLowerCase(),
                      )}
                      amount={order.totalAmount}
                      currency={currency}
                    />
                  </div>
                </header>

                <div className="px-6 py-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-3 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase">
                      Order Items
                    </h3>
                    <ul className="space-y-3">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.quantity} × {item.displayName || item.productSnapshot?.title || item.dishId}
                            </p>
                            <p className="text-xs text-slate-500">
                              Size: {item.size}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-700">
                            {currency}
                            {resolveItemPrice(item).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-700 uppercase">
                        Customer & Delivery
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 font-medium">
                        {customerName}
                      </p>
                      {address.phone ? (
                        <p className="text-xs text-slate-500">Phone: {address.phone}</p>
                      ) : null}
                      <p className="text-xs text-slate-500 mt-2 leading-5">
                        {[address.street, address.ward, address.district, address.city]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Payment Method</span>
                        <span className="font-semibold">{order.paymentMethod}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Subtotal</span>
                        <span className="font-semibold">
                          {currency}
                          {order.subtotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Shipping fee</span>
                        <span className="font-semibold">
                          {currency}
                          {order.shippingFee.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total</span>
                        <span className="font-semibold">
                          {currency}
                          {order.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/60">
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                      type="button"
                    >
                      Print Receipt
                    </button>
                    <button
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                      type="button"
                    >
                      Contact Customer
                    </button>
                  </div>
                  <div className="text-xs text-slate-500">
                    Last updated on{" "}
                    {new Date(order.updatedAt || order.placedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </footer>
              </article>
            );
          })}

          {!filteredOrders.length && !loading && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
              No orders found in this state. Switch status tabs or reset your search.
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const StatusSelect = ({ defaultValue, onChange }) => (
  <select
    defaultValue={defaultValue}
    onChange={(event) => onChange(event.target.value)}
    className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
  >
    {ORDER_STATUS_TABS.map((tab) => (
      <option key={tab.key} value={tab.key}>
        {tab.label}
      </option>
    ))}
  </select>
);

const PaymentStatus = ({ paid, amount, currency }) => {
  const displayAmount = Number(amount) || 0;
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
      <span className={paid ? "text-emerald-600" : "text-orange-600"}>
        {paid ? "Paid" : "Awaiting Payment"}
      </span>
      <span className="text-slate-500">
        {currency}
        {displayAmount.toLocaleString()}
      </span>
    </div>
  );
};

export default Orders;
