import React, { useMemo, useState } from "react";
import { dummyOrdersData } from "../../assets/data";
import { useAppContext } from "../../context/AppContext";

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const statusGroups = [
    { key: "new", label: "New", match: ["Order Placed"] },
    { key: "prep", label: "In Preparation", match: ["Packing", "Shipping"] },
    { key: "delivery", label: "In Delivery", match: ["Out for delivery"] },
    { key: "completed", label: "Completed", match: ["Delivered"] },
    { key: "canceled", label: "Canceled", match: ["Canceled"] },
];

const Orders = () => {
    const { currency } = useAppContext();
    const [activeTab, setActiveTab] = useState(statusGroups[0].key);
    const [searchValue, setSearchValue] = useState("");

    const filteredOrders = useMemo(() => {
        const group = statusGroups.find(item => item.key === activeTab);
        const matchSet = new Set(group?.match ?? []);
        return dummyOrdersData.filter(order => {
            const matchesStatus = matchSet.size === 0 || matchSet.has(order.status);
            const matchesSearch =
                !searchValue ||
                order._id.toLowerCase().includes(searchValue.toLowerCase()) ||
                order.address.firstName.toLowerCase().includes(searchValue.toLowerCase()) ||
                order.address.lastName.toLowerCase().includes(searchValue.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [activeTab, searchValue]);

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
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {statusGroups.map(group => (
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
                                    {dummyOrdersData.filter(order => group.match.includes(order.status)).length}
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
                                                {item.product.price[item.size].toFixed(2)}
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
        <option value="Order Placed">Order Placed</option>
        <option value="Packing">Packing</option>
        <option value="Shipping">Shipping</option>
        <option value="Out for delivery">Out for delivery</option>
        <option value="Delivered">Delivered</option>
        <option value="Canceled">Canceled</option>
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
