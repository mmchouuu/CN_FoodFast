import React, { useCallback, useEffect, useMemo, useState } from "react";
import ownerOrdersService from "../../services/ownerOrders";
import restaurantManagerService from "../../services/restaurantManager";
import { useAppContext } from "../../context/AppContext";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";
const PAID_STATUSES = new Set(["paid", "authorized", "partially_refunded", "refunded"]);

const ORDER_STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivering", label: "Delivering" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const resolveItemTotal = (item) => {
  if (!item) return 0;
  if (item.totalPrice !== undefined) return Number(item.totalPrice) || 0;
  if (item.total_price !== undefined) return Number(item.total_price) || 0;
  const qty = Number(item.quantity) || 0;
  const unit = Number(item.unitPrice ?? item.unit_price ?? 0) || 0;
  return qty * unit;
};

const normaliseAddress = (address) => {
  if (!address) {
    return {
      firstName: "",
      lastName: "",
      fullName: "",
      phone: "",
      street: "",
      district: "",
      city: "",
      state: "",
      country: "",
      zipcode: "",
    };
  }

  if (typeof address === "string") {
    return {
      firstName: "",
      lastName: "",
      fullName: address,
      phone: "",
      street: address,
      district: "",
      city: "",
      state: "",
      country: "",
      zipcode: "",
    };
  }

  const firstName =
    address.first_name ||
    address.firstName ||
    address.recipient_first_name ||
    "";
  const lastName =
    address.last_name ||
    address.lastName ||
    address.recipient_last_name ||
    "";
  const fullName =
    address.recipient ||
    [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    firstName,
    lastName,
    fullName,
    phone:
      address.phone ||
      address.contact_phone ||
      address.recipient_phone ||
      "",
    street:
      address.street ||
      address.address_line1 ||
      address.line1 ||
      address.address1 ||
      "",
    district: address.district || address.neighbourhood || "",
    city: address.city || address.town || "",
    state: address.state || address.province || "",
    country: address.country || "",
    zipcode: address.zipcode || address.postal_code || "",
  };
};

const buildLookups = (restaurants = []) => {
  const restaurantMap = new Map();
  const branchMap = new Map();

  restaurants.forEach((restaurant) => {
    if (!restaurant?.id) return;
    restaurantMap.set(String(restaurant.id), restaurant);
    const branches = Array.isArray(restaurant.branches) ? restaurant.branches : [];
    branches.forEach((branch) => {
      if (!branch?.id) return;
      branchMap.set(String(branch.id), {
        ...branch,
        restaurantId: restaurant.id,
      });
    });
  });

  return { restaurantMap, branchMap };
};

const adaptOwnerOrder = (order, lookups) => {
  if (!order) return null;

  const restaurantId = order.restaurant_id || order.restaurantId || null;
  const branchId = order.branch_id || order.branchId || null;
  const metadata =
    order.metadata && typeof order.metadata === "object" ? order.metadata : {};
  const paymentMeta =
    metadata.payment && typeof metadata.payment === "object"
      ? metadata.payment
      : {};

  const deliverySnapshot =
    order.delivery?.delivery_address ||
    metadata.delivery_address ||
    order.delivery_snapshot ||
    order.shipping_address_snapshot ||
    null;
  const address = normaliseAddress(deliverySnapshot);

  const restaurantRecord = lookups.restaurantMap.get(String(restaurantId));
  const branchRecord = lookups.branchMap.get(String(branchId));

  const restaurantName =
    metadata.restaurant_name ||
    metadata.restaurant_snapshot?.name ||
    restaurantRecord?.name ||
    restaurantRecord?.legalName ||
    null;
  const branchName =
    metadata.branch_name ||
    metadata.branch_snapshot?.name ||
    branchRecord?.name ||
    null;

  const items = Array.isArray(order.items)
    ? order.items.map((item) => ({
        id: item.id,
        name:
          item.product_snapshot?.title ||
          item.product_snapshot?.name ||
          item.product_name ||
          "Menu item",
        quantity: Number(item.quantity) || 0,
        unitPrice:
          Number(item.unit_price ?? item.product_snapshot?.price ?? 0) || 0,
        totalPrice:
          Number(
            item.total_price ??
              (Number(item.unit_price ?? 0) || 0) *
                (Number(item.quantity ?? 0) || 0),
          ) || 0,
        size:
          item.product_snapshot?.size ||
          item.product_snapshot?.variant ||
          "Standard",
      }))
    : [];

  const totalAmount =
    Number(order.total_amount ?? metadata?.pricing?.total ?? 0) || 0;
  const paymentStatus = (order.payment_status || "").toLowerCase();
  const paymentMethodRaw =
    paymentMeta.method ||
    order.payment_method ||
    order.paymentMethod ||
    "cod";

  const customerName =
    metadata.customer_name ||
    order.delivery?.contact_name ||
    address.fullName ||
    [address.firstName, address.lastName].filter(Boolean).join(" ").trim() ||
    null;

  return {
    id: order.id,
    displayCode:
      order.order_code ||
      order.short_code ||
      order.reference_code ||
      (order.id ? `#${order.id.slice(0, 8)}` : ""),
    restaurantId,
    restaurantName: restaurantName || "Restaurant",
    branchId,
    branchName: branchName || "Branch",
    status: (order.status || "").toLowerCase(),
    paymentStatus,
    paymentMethod: String(paymentMethodRaw).toUpperCase(),
    isPaid: PAID_STATUSES.has(paymentStatus),
    totalAmount,
    createdAt: order.created_at || order.createdAt,
    updatedAt: order.updated_at || order.updatedAt || order.created_at,
    deliveryWindow: order.delivery?.estimated_at || null,
    address,
    customerName,
    items,
  };
};

const Orders = () => {
  const { currency, restaurantProfile } = useAppContext();
  const ownerId = restaurantProfile?.id || null;

  const [ownerRestaurants, setOwnerRestaurants] = useState([]);
  const [rawOrders, setRawOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState(ORDER_STATUS_TABS[0].key);
  const [searchValue, setSearchValue] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState("all");

  const lookups = useMemo(
    () => buildLookups(ownerRestaurants),
    [ownerRestaurants],
  );

  const orders = useMemo(
    () =>
      rawOrders
        .map((order) => adaptOwnerOrder(order, lookups))
        .filter(Boolean),
    [rawOrders, lookups],
  );

  useEffect(() => {
    if (!ownerId) {
      setOwnerRestaurants([]);
      setRawOrders([]);
      return;
    }

    let cancelled = false;

    const fetchRestaurants = async () => {
      setRestaurantsLoading(true);
      try {
        const data = await restaurantManagerService.listByOwner(ownerId);
        if (cancelled) return;
        const list = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        setOwnerRestaurants(list);
      } catch (err) {
        if (cancelled) return;
        console.error("[owner-orders] failed to load restaurants", err);
        setOwnerRestaurants([]);
      } finally {
        if (!cancelled) {
          setRestaurantsLoading(false);
        }
      }
    };

    fetchRestaurants();

    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const loadOrders = useCallback(async () => {
    if (!ownerId) {
      setRawOrders([]);
      return;
    }

    setOrdersLoading(true);
    try {
      const params = { limit: 200 };
      if (selectedRestaurantId !== "all") {
        params.restaurant_id = selectedRestaurantId;
      }
      if (selectedBranchId !== "all") {
        params.branch_id = selectedBranchId;
      }

      const response = await ownerOrdersService.list(params);
      const list = Array.isArray(response?.data) ? response.data : [];
      setRawOrders(list);
      setError("");
    } catch (err) {
      console.error("[owner-orders] failed to load orders", err);
      const message =
        err?.response?.data?.error ||
        err?.message ||
        "Unable to load orders. Please try again.";
      setError(message);
      setRawOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [ownerId, selectedBranchId, selectedRestaurantId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const restaurantOptions = useMemo(() => {
    return ownerRestaurants.map((restaurant) => ({
      id: restaurant.id,
      name:
        restaurant.name ||
        restaurant.legalName ||
        restaurant.profile?.legal_name ||
        "Restaurant",
    }));
  }, [ownerRestaurants]);

  const branchOptions = useMemo(() => {
    const options = [];
    ownerRestaurants.forEach((restaurant) => {
      if (!restaurant?.branches) return;
      if (
        selectedRestaurantId !== "all" &&
        String(restaurant.id) !== String(selectedRestaurantId)
      ) {
        return;
      }
      restaurant.branches.forEach((branch) => {
        options.push({
          id: branch.id,
          name: branch.name || "Branch",
          restaurantId: restaurant.id,
        });
      });
    });
    return options;
  }, [ownerRestaurants, selectedRestaurantId]);

  useEffect(() => {
    if (
      selectedRestaurantId !== "all" &&
      !restaurantOptions.some((item) => String(item.id) === String(selectedRestaurantId))
    ) {
      setSelectedRestaurantId("all");
    }
  }, [restaurantOptions, selectedRestaurantId]);

  useEffect(() => {
    if (selectedBranchId === "all") return;
    if (!branchOptions.some((item) => String(item.id) === String(selectedBranchId))) {
      setSelectedBranchId("all");
    }
  }, [branchOptions, selectedBranchId]);

  const ordersFilteredByLocation = useMemo(() => {
    return orders.filter((order) => {
      const matchesRestaurant =
        selectedRestaurantId === "all" ||
        String(order.restaurantId) === String(selectedRestaurantId);
      const matchesBranch =
        selectedBranchId === "all" ||
        String(order.branchId) === String(selectedBranchId);
      return matchesRestaurant && matchesBranch;
    });
  }, [orders, selectedBranchId, selectedRestaurantId]);

  const statusCounts = useMemo(() => {
    const counts = ORDER_STATUS_TABS.reduce((acc, tab) => {
      if (tab.key !== "all") {
        acc[tab.key] = 0;
      }
      return acc;
    }, {});

    ordersFilteredByLocation.forEach((order) => {
      const key = order.status || "";
      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });

    return counts;
  }, [ordersFilteredByLocation]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return ordersFilteredByLocation.filter((order) => {
      const matchesStatus =
        activeTab === "all" || (order.status || "") === activeTab;
      if (!matchesStatus) return false;

      if (!normalizedSearch) return true;

      const idMatch =
        order.displayCode?.toLowerCase().includes(normalizedSearch) ||
        order.id?.toLowerCase().includes(normalizedSearch);
      const customerMatch = order.customerName
        ? order.customerName.toLowerCase().includes(normalizedSearch)
        : false;
      const addressMatch = order.address?.street
        ? order.address.street.toLowerCase().includes(normalizedSearch)
        : false;

      return idMatch || customerMatch || addressMatch;
    });
  }, [activeTab, ordersFilteredByLocation, searchValue]);

  if (!ownerId) {
    return (
      <div className="max-padd-container py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-800">
            Sign in as a restaurant owner
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            This dashboard is available only for approved restaurant accounts.
            Please sign in with your owner credentials to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-sm text-slate-600">
            Monitor live orders, update status, and keep customers informed.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">
            Export Orders
          </button>
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
            Print Kitchen Tickets
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-500">Restaurant</span>
            <select
              value={selectedRestaurantId}
              onChange={(event) => setSelectedRestaurantId(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              <option value="all">All restaurants</option>
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wide text-slate-500">Branch</span>
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              <option value="all">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUS_TABS.map((group) => {
              const count =
                group.key === "all"
                  ? ordersFilteredByLocation.length
                  : statusCounts[group.key] ?? 0;
              return (
                <button
                  type="button"
                  key={group.key}
                  onClick={() => setActiveTab(group.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === group.key
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {group.label}
                  <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M18 10.5A7.5 7.5 0 113 10.5a7.5 7.5 0 0115 0z"
                />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search order ID or customer"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {(ordersLoading || restaurantsLoading) && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Loading order data...
        </div>
      )}

      <section className="mt-6 space-y-4">
        {filteredOrders.map((order) => (
          <article
            key={order.id}
            className="bg-white rounded-xl shadow-sm border border-slate-100"
          >
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Order {order.displayCode}
                </p>
                <p className="text-xs font-semibold text-emerald-600">
                  {order.restaurantName} • {order.branchName}
                </p>
                <p className="text-sm text-slate-500">
                  Placed on{" "}
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "N/A"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <StatusSelect defaultValue={order.status} />
                <PaymentStatus
                  paid={order.isPaid}
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
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Size: {item.size} · Quantity: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {currency}
                        {resolveItemTotal(item).toLocaleString()}
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
                    {order.customerName || "Customer"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Phone: {order.address.phone || "N/A"}
                  </p>
                  <p className="text-xs text-slate-500 mt-2 leading-5">
                    {[order.address.street, order.address.district, order.address.city]
                      .filter(Boolean)
                      .join(", ")}
                    {order.address.state ? `, ${order.address.state}` : ""}
                    {order.address.country ? ` • ${order.address.country}` : ""}
                    {order.address.zipcode ? ` • ${order.address.zipcode}` : ""}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Payment Method</span>
                    <span className="font-semibold">{order.paymentMethod}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Amount</span>
                    <span className="font-semibold">
                      {currency}
                      {Number(order.totalAmount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Status</span>
                    <span className="capitalize">{order.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/60">
              <div className="flex flex-wrap gap-3">
                <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                  Print Receipt
                </button>
                <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                  Contact Customer
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Last updated{" "}
                {order.updatedAt
                  ? new Date(order.updatedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "N/A"}
              </div>
            </footer>
          </article>
        ))}

        {!ordersLoading && !restaurantsLoading && !filteredOrders.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
            No orders found in this state. Switch status tabs or reset your search.
          </div>
        ) : null}
      </section>
    </div>
  );
};

const StatusSelect = ({ defaultValue }) => (
  <select
    defaultValue={defaultValue}
    className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
  >
    {ORDER_STATUS_TABS.filter((tab) => tab.key !== "all").map((tab) => (
      <option key={tab.key} value={tab.key}>
        {tab.label}
      </option>
    ))}
  </select>
);

const PaymentStatus = ({ paid, amount, currency }) => (
  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
    <span className={paid ? "text-emerald-600" : "text-orange-600"}>
      {paid ? "Paid" : "Awaiting Payment"}
    </span>
    <span className="text-slate-500">
      {currency}
      {Number(amount || 0).toLocaleString()}
    </span>
  </div>
);

export default Orders;
