import React from "react";
import { dummyOrdersData } from "../../assets/data";

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const availableShippers = [
    { id: "shipper-01", name: "Nguyen Van A", currentLoad: 2, eta: "5 min" },
    { id: "shipper-02", name: "Tran Thi B", currentLoad: 1, eta: "12 min" },
    { id: "shipper-04", name: "Pham D", currentLoad: 0, eta: "Ready" },
];

const AssignOrders = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Assign Orders to Shippers</h1>
                    <p className="text-sm text-slate-600">
                        Balance workloads and dispatch orders to the most suitable shipper in seconds.
                    </p>
                </div>
                <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                    Auto-Assign All
                </button>
            </header>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    {dummyOrdersData.map(order => (
                        <article key={order._id} className="rounded-xl border border-slate-100 bg-white shadow-sm">
                            <header className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-xs uppercase text-slate-500">Order #{order._id}</p>
                                    <p className="text-sm text-slate-500">
                                        {order.items.length} items · {order.paymentMethod} · {order.address.city}
                                    </p>
                                </div>
                                <select className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60">
                                    <option value="">Select Shipper</option>
                                    {availableShippers.map(shipper => (
                                        <option key={shipper.id} value={shipper.id}>
                                            {shipper.name} · {shipper.currentLoad} active
                                        </option>
                                    ))}
                                </select>
                            </header>
                            <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-2">
                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery Window</h3>
                                    <p className="mt-2 text-base font-semibold text-slate-800">
                                        ETA within 25 minutes
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Preferred time: {new Date(order.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Notes</h3>
                                    <p className="mt-2 text-sm text-slate-600">
                                        Leave at front desk. Call on arrival. Avoid spicy toppings.
                                    </p>
                                </div>
                            </div>
                            <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                <div className="text-xs text-slate-500">
                                    Automatically suggest best shipper based on proximity and workload.
                                </div>
                                <div className="flex gap-3">
                                    <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                                        Preview Route
                                    </button>
                                    <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">
                                        Assign Shipper
                                    </button>
                                </div>
                            </footer>
                        </article>
                    ))}
                </div>

                <aside className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Shipper Queue</h2>
                        <p className="text-sm text-slate-500">
                            Compare workloads to keep deliveries on time.
                        </p>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600">
                        {availableShippers.map(shipper => (
                            <li key={shipper.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-slate-800">{shipper.name}</p>
                                    <span className="text-xs font-semibold text-emerald-600">{shipper.eta}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Current orders: {shipper.currentLoad}
                                </p>
                                <button className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                    View Recent Deliveries
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-700">
                        Tip: Enable auto-assignment during rush hours to dispatch orders based on shipper proximity and load.
                    </div>
                </aside>
            </section>
        </div>
    );
};

export default AssignOrders;
