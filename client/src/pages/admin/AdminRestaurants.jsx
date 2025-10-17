import React from "react";

const restaurants = [
    { id: "RES-204", name: "Pho Master", owner: "Luong Nguyen", status: "Active", revenue: "$82,400", orders: 1240, pending: false },
    { id: "RES-211", name: "Saigon Street Bites", owner: "Minh Tran", status: "Pending Review", revenue: "$0", orders: 0, pending: true },
    { id: "RES-198", name: "Lotus Vegan", owner: "Alice Ngo", status: "Suspended", revenue: "$12,500", orders: 214, pending: false },
];

const AdminRestaurants = () => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Restaurant Management</h1>
                <p className="text-sm text-neutral-600">
                    Track operating status, revenue performance, and approve new restaurant applications.
                </p>
            </div>
            <div className="flex gap-3">
                <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
                    Export Report
                </button>
                <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                    Approve Selected
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Active Restaurants" value="1,247" detail="All regions" />
            <MetricCard label="Pending Approval" value="18" detail="Awaiting verification" />
            <MetricCard label="Suspended" value="12" detail="Requires follow up" />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        All
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Active
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Pending
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Suspended
                    </button>
                </div>
                <div className="relative w-full md:w-72">
                    <input
                        type="search"
                        placeholder="Search by restaurant or owner"
                        className="w-full rounded-lg border border-neutral-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                </div>
            </div>
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left uppercase text-xs font-semibold text-neutral-500 tracking-wide">
                    <tr>
                        <th className="px-6 py-3">Restaurant</th>
                        <th className="px-6 py-3">Owner</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Revenue (30d)</th>
                        <th className="px-6 py-3">Orders (30d)</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                    {restaurants.map(restaurant => (
                        <tr key={restaurant.id} className="hover:bg-neutral-50/80">
                            <td className="px-6 py-4">
                                <p className="font-semibold text-neutral-800">{restaurant.name}</p>
                                <p className="text-xs text-neutral-500">{restaurant.id}</p>
                            </td>
                            <td className="px-6 py-4 text-neutral-600">{restaurant.owner}</td>
                            <td className="px-6 py-4">
                                <StatusBadge status={restaurant.status} />
                            </td>
                            <td className="px-6 py-4 text-neutral-600">{restaurant.revenue}</td>
                            <td className="px-6 py-4 text-neutral-600">{restaurant.orders}</td>
                            <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center gap-3">
                                    {restaurant.pending ? (
                                        <>
                                            <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                                                Approve
                                            </button>
                                            <button className="text-xs font-semibold text-rose-600 hover:text-rose-700">
                                                Reject
                                            </button>
                                        </>
                                    ) : (
                                        <button className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                                            View
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const MetricCard = ({ label, value, detail }) => (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
        <p className="text-xs text-neutral-500 mt-2">{detail}</p>
    </div>
);

const badgeStyles = {
    Active: "bg-emerald-100 text-emerald-700",
    "Pending Review": "bg-amber-100 text-amber-700",
    Suspended: "bg-rose-100 text-rose-700",
};

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status] ?? "bg-neutral-200 text-neutral-600"}`}>
        {status}
    </span>
);

export default AdminRestaurants;
