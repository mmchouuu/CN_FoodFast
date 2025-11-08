import React from "react";
import { assets } from "../../assets/data";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const shipperList = [
    {
        id: "shipper-01",
        name: "Nguyen Van A",
        phone: "0901 234 567",
        status: "Online",
        ordersToday: 8,
        averageRating: 4.9,
        vehicle: "Motorbike",
    },
    {
        id: "shipper-02",
        name: "Tran Thi B",
        phone: "0903 111 222",
        status: "In Delivery",
        ordersToday: 6,
        averageRating: 4.7,
        vehicle: "Motorbike",
    },
    {
        id: "shipper-03",
        name: "Le Van C",
        phone: "0908 555 888",
        status: "Offline",
        ordersToday: 2,
        averageRating: 4.3,
        vehicle: "Bicycle",
    },
];

const ShipperManagement = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Shipper Management</h1>
                    <p className="text-sm text-slate-600">
                        Monitor restaurant delivery staff availability, performance, and assignments.
                    </p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                    <img src={assets.plus} alt="plus icon" className="h-4 w-4" />
                    Add Shipper
                </button>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Online Shippers" value="12" trend="+3 vs yesterday" accent="bg-emerald-100 text-emerald-700" />
                <StatCard label="In Delivery" value="5" trend="2 orders finishing soon" accent="bg-blue-100 text-blue-700" />
                <StatCard label="Completed Today" value="46 deliveries" trend="Avg rating 4.8" accent="bg-purple-100 text-purple-700" />
            </section>

            <section className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <header className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Active Shippers</h2>
                        <p className="text-sm text-slate-500">
                            Manage availability, performance, and delivery capacity.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition">
                            Show Online
                        </button>
                        <button className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition">
                            Export Roster
                        </button>
                    </div>
                </header>
                <div className="divide-y divide-slate-100">
                    {shipperList.map(shipper => (
                        <article key={shipper.id} className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-col gap-1">
                                <p className="text-sm uppercase text-slate-500">#{shipper.id}</p>
                                <h3 className="text-base font-semibold text-slate-900">{shipper.name}</h3>
                                <p className="text-sm text-slate-500">{shipper.phone} · {shipper.vehicle}</p>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <InfoPill label="Status" value={shipper.status} />
                                <InfoPill label="Orders Today" value={`${shipper.ordersToday}`} />
                                <InfoPill label="Average Rating" value={`${shipper.averageRating}★`} />
                            </div>
                            <div className="flex gap-3">
                                <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                                    Edit
                                </button>
                                <button className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition">
                                    Remove
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="h-full rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Availability Schedule</h2>
                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                            Update Slots
                        </button>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600">
                        {["Lunch Rush · 10:30 - 14:00", "Afternoon · 14:00 - 17:00", "Dinner Peak · 17:00 - 21:00"].map(slot => (
                            <li key={slot} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
                                <span>{slot}</span>
                                <span className="text-xs font-semibold text-emerald-600">Open</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="h-full rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Performance Alerts</h2>
                        <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
                            Archive All
                        </button>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600">
                        <li className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
                            <span className="text-orange-500 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </span>
                            <div>
                                <p className="font-semibold text-slate-800">Late delivery warning</p>
                                <p className="text-xs text-slate-500">Shipper Tran Thi B delayed 12 minutes on order #51823.</p>
                            </div>
                        </li>
                        <li className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
                            <span className="text-emerald-500 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                            <div>
                                <p className="font-semibold text-slate-800">High rating</p>
                                <p className="text-xs text-slate-500">Nguyen Van A reached 4.9★ average over 25 reviews.</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    );
};

const StatCard = ({ label, value, trend, accent }) => (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
        <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>
            {trend}
        </span>
    </div>
);

const statusVariants = {
    Online: "bg-emerald-100 text-emerald-700",
    Offline: "bg-slate-100 text-slate-600",
    "In Delivery": "bg-blue-100 text-blue-700",
};

const InfoPill = ({ label, value }) => (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="text-slate-500 uppercase">{label}</span>
        <span className={`font-semibold ${statusVariants[value] ?? "text-slate-700"}`}>{value}</span>
    </div>
);

export default ShipperManagement;






