import React, { useEffect, useMemo, useState } from "react";
import { dummyOrdersData } from "../../assets/data";
import { useAppContext } from "../../context/AppContext";

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
    const productPrice = item.product?.price;
    if (productPrice && typeof productPrice === "object") {
        const bySize = productPrice[item.size];
        if (bySize !== undefined) return Number(bySize) || 0;
        if (productPrice.Standard !== undefined) return Number(productPrice.Standard) || 0;
        const firstKey = Object.keys(productPrice)[0];
        if (firstKey && productPrice[firstKey] !== undefined) {
            return Number(productPrice[firstKey]) || 0;
        }
    }
    if (typeof productPrice === "number") return productPrice;
    if (item.unit_price !== undefined) return Number(item.unit_price) || 0;
    if (item.line_total !== undefined) return Number(item.line_total) || 0;
    return 0;
};

const Orders = () => {
    const { currency } = useAppContext();
    const [activeTab, setActiveTab] = useState(ORDER_STATUS_TABS[0].key);
    const [searchValue, setSearchValue] = useState("");
    const [selectedRestaurantId, setSelectedRestaurantId] = useState("all");
    const [selectedBranchId, setSelectedBranchId] = useState("all");

    const restaurantOptions = useMemo(() => {
        const map = new Map();
        dummyOrdersData.forEach(order => {
            if (!order.restaurantId) return;
            if (map.has(order.restaurantId)) return;
            map.set(order.restaurantId, {
                id: order.restaurantId,
                name: order.restaurantName || "Unnamed restaurant",
            });
        });
        return Array.from(map.values());
    }, []);

    const branchOptions = useMemo(() => {
        const map = new Map();
        dummyOrdersData
            .filter(order => selectedRestaurantId === "all" || order.restaurantId === selectedRestaurantId)
            .forEach(order => {
                if (!order.branchId || map.has(order.branchId)) return;
                map.set(order.branchId, {
                    id: order.branchId,
                    name: order.branchName || "Unnamed branch",
                    restaurantId: order.restaurantId,
                });
            });
        return Array.from(map.values());
    }, [selectedRestaurantId]);

    useEffect(() => {
        if (selectedRestaurantId !== "all" && !restaurantOptions.some(item => item.id === selectedRestaurantId)) {
            setSelectedRestaurantId("all");
        }
    }, [selectedRestaurantId, restaurantOptions]);

    useEffect(() => {
        if (selectedBranchId === "all") return;
        if (!branchOptions.some(item => item.id === selectedBranchId)) {
            setSelectedBranchId("all");
        }
    }, [selectedBranchId, branchOptions]);

    const ordersFilteredByLocation = useMemo(() => {
        return dummyOrdersData.filter(order => {
            const matchesRestaurant =
                selectedRestaurantId === "all" || order.restaurantId === selectedRestaurantId;
            const matchesBranch = selectedBranchId === "all" || order.branchId === selectedBranchId;
            return matchesRestaurant && matchesBranch;
        });
    }, [selectedBranchId, selectedRestaurantId]);

    const statusCounts = useMemo(() => {
        const counts = ORDER_STATUS_TABS.reduce((acc, tab) => ({ ...acc, [tab.key]: 0 }), {});
        ordersFilteredByLocation.forEach(order => {
            const key = (order.status || "").toLowerCase();
            if (counts[key] !== undefined) {
                counts[key] += 1;
            }
        });
        return counts;
    }, [ordersFilteredByLocation]);

    const filteredOrders = useMemo(() => {
        const normalizedSearch = searchValue.trim().toLowerCase();
        return ordersFilteredByLocation.filter(order => {
            const orderStatus = (order.status || "").toLowerCase();
            const matchesStatus = orderStatus === activeTab;
            const matchesSearch =
                !normalizedSearch ||
                order._id.toLowerCase().includes(normalizedSearch) ||
                order.address.firstName.toLowerCase().includes(normalizedSearch) ||
                order.address.lastName.toLowerCase().includes(normalizedSearch);
            return matchesStatus && matchesSearch;
        });
    }, [activeTab, ordersFilteredByLocation, searchValue]);

    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
                    <p className="text-sm text-slate-600">
                        Monitor the full order lifecycle, update statuses, and track payments in one place.
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

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
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
                        {ORDER_STATUS_TABS.map(group => (
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
                                    {statusCounts[group.key] ?? 0}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-72">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M18 10.5A7.5 7.5 0 113 10.5a7.5 7.5 0 0115 0z" />
                            </svg>
                        </span>
                        <input
                            type="search"
                            placeholder="Search order ID or customer"
                            value={searchValue}
                            onChange={event => setSearchValue(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                    </div>
                </div>
            </div>

            <section className="mt-6 space-y-4">
                {filteredOrders.map(order => (
                    <article key={order._id} className="bg-white rounded-xl shadow-sm border border-slate-100">
                        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                    Order #{order._id}
                                </p>
                                <p className="text-xs font-semibold text-emerald-600">
                                    {(order.restaurantName || "Restaurant")} • {(order.branchName || "Branch")}
                                </p>
                                <p className="text-sm text-slate-500">
                                    Placed on{" "}
                                    {new Date(order.createdAt).toLocaleString(undefined, {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                    })}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <StatusSelect defaultValue={order.status} />
                                <PaymentStatus paid={order.isPaid} amount={order.amount} currency={currency} />
                            </div>
                        </header>

                        <div className="px-6 py-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <div className="space-y-3 lg:col-span-2">
                                <h3 className="text-sm font-semibold text-slate-700 uppercase">Order Items</h3>
                                <ul className="space-y-3">
                                    {order.items.map(item => (
                                        <li key={item._id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-800">{item.product.title}</p>
                                                <p className="text-xs text-slate-500">
                                                    Size: {item.size} · Quantity: {item.quantity}
                                                </p>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700">
                                                {currency}
                                                {resolveItemPrice(item).toFixed(2)}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                    <h3 className="text-sm font-semibold text-slate-700 uppercase">Customer & Delivery</h3>
                                    <p className="mt-2 text-sm text-slate-600 font-medium">
                                        {order.address.firstName} {order.address.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500">Phone: {order.address.phone}</p>
                                    <p className="text-xs text-slate-500 mt-2 leading-5">
                                        {order.address.street}, {order.address.city}, {order.address.state}
                                        <br />
                                        {order.address.country} · {order.address.zipcode}
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
                                            {currency}{order.amount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span>Shipping</span>
                                        <span>Included in subtotal</span>
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
                                Last updated on{" "}
                                {new Date(order.updatedAt).toLocaleString(undefined, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })}
                            </div>
                        </footer>
                    </article>
                ))}

                {!filteredOrders.length && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
                        No orders found in this state. Switch status tabs or reset your search.
                    </div>
                )}
            </section>
        </div>
    );
};

const StatusSelect = ({ defaultValue }) => (
    <select
        defaultValue={defaultValue}
        className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
    >
        {ORDER_STATUS_TABS.map((tab) => (
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
            {currency}{amount.toFixed(2)}
        </span>
    </div>
);

export default Orders;






