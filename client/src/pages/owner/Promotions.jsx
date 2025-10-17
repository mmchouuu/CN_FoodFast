import React from "react";

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const campaigns = [
    {
        id: "promo-01",
        name: "Lunch Combo Discount",
        type: "Combo",
        status: "Active",
        redemption: 124,
        period: "Apr 1 - Apr 30",
    },
    {
        id: "promo-02",
        name: "Free Delivery Weekend",
        type: "Voucher",
        status: "Scheduled",
        redemption: 0,
        period: "May 11 - May 12",
    },
    {
        id: "promo-03",
        name: "New Customer -15%",
        type: "Voucher",
        status: "Expired",
        redemption: 362,
        period: "Mar 1 - Mar 31",
    },
];

const Promotions = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Promotions & Vouchers</h1>
                    <p className="text-sm text-slate-600">
                        Create custom promotions, track voucher performance, and reward loyal customers.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
                        Import Codes
                    </button>
                    <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                        Create Promotion
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard title="Active Promotions" value="4" detail="+1 starting this week" tone="bg-emerald-100 text-emerald-700" />
                <MetricCard title="Voucher Redemptions" value="486" detail="Whole month to date" tone="bg-blue-100 text-blue-700" />
                <MetricCard title="Free Shipping Usage" value="132" detail="Last 7 days" tone="bg-purple-100 text-purple-700" />
            </section>

            <section className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left uppercase text-xs font-medium text-slate-500 tracking-wide">
                        <tr>
                            <th className="px-6 py-4">Campaign</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Redemptions</th>
                            <th className="px-6 py-4">Period</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {campaigns.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                                <td className="px-6 py-4">
                                    <p className="font-semibold text-slate-800">{item.name}</p>
                                    <p className="text-xs text-slate-500">#{item.id}</p>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{item.type}</td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={item.status} />
                                </td>
                                <td className="px-6 py-4 text-slate-600">{item.redemption}</td>
                                <td className="px-6 py-4 text-slate-600">{item.period}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="inline-flex items-center gap-3">
                                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                            Edit
                                        </button>
                                        <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
                                            View Report
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Quick Voucher Generator</h2>
                        <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
                            Reset
                        </button>
                    </div>
                    <form className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Voucher Label</label>
                            <input
                                type="text"
                                placeholder="E.g. FREESHIPAPRIL"
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Discount Type</label>
                                <select className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60">
                                    <option value="percentage">Percentage</option>
                                    <option value="amount">Fixed Amount</option>
                                    <option value="shipping">Free Shipping</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Value</label>
                                <input
                                    type="number"
                                    placeholder="10"
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Minimum Order Value</label>
                            <input
                                type="number"
                                placeholder="200000"
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                            />
                        </div>
                        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                            Generate Voucher
                        </button>
                    </form>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Performance Insights</h2>
                    <ul className="space-y-3 text-sm text-slate-600">
                        <li className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <p className="font-semibold text-emerald-700">Delivery discounts drive 28% higher conversion.</p>
                            <p className="text-xs text-slate-500 mt-1">Consider extending free shipping to weekday evenings.</p>
                        </li>
                        <li className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                            <p className="font-semibold text-blue-700">Combo bundles perform best on weekends.</p>
                            <p className="text-xs text-slate-500 mt-1">Suggested: weekend-only push notifications.</p>
                        </li>
                        <li className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
                            <p className="font-semibold text-purple-700">Loyalty customers redeem 2.4x more vouchers.</p>
                            <p className="text-xs text-slate-500 mt-1">Launch a VIP promotion to maintain retention.</p>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    );
};

const MetricCard = ({ title, value, detail, tone }) => (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
        <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
            {detail}
        </span>
    </div>
);

const statusStyles = {
    Active: "bg-emerald-100 text-emerald-700",
    Scheduled: "bg-blue-100 text-blue-700",
    Expired: "bg-slate-200 text-slate-600",
};

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? "bg-slate-100 text-slate-600"}`}>
        {status}
    </span>
);

export default Promotions;
