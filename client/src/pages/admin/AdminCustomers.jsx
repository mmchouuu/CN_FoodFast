import React from "react";

const customers = [
    { id: "CUS-1034", name: "Linh Tran", email: "linh.tran@example.com", status: "Active", orders: 54, loyalty: "Gold" },
    { id: "CUS-1098", name: "David Wong", email: "david.wong@example.com", status: "Locked", orders: 3, loyalty: "Bronze" },
    { id: "CUS-1110", name: "Thu Nguyen", email: "thu.nguyen@example.com", status: "Active", orders: 12, loyalty: "Silver" },
];

const AdminCustomers = () => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Customer Management</h1>
                <p className="text-sm text-neutral-600">
                    Maintain user accounts, apply restrictions, and review basic profile activity.
                </p>
            </div>
            <div className="flex gap-3">
                <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
                    Export Customers
                </button>
                <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                    Invite New User
                </button>
            </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:w-72">
                    <input
                        type="search"
                        placeholder="Search by name or email"
                        className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-3 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        All
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Locked
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        VIP
                    </button>
                </div>
            </div>
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left uppercase text-xs font-semibold text-neutral-500 tracking-wide">
                    <tr>
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Orders</th>
                        <th className="px-6 py-3">Tier</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                    {customers.map(customer => (
                        <tr key={customer.id} className="hover:bg-neutral-50/80">
                            <td className="px-6 py-4">
                                <p className="font-semibold text-neutral-800">{customer.name}</p>
                                <p className="text-xs text-neutral-500">{customer.id}</p>
                            </td>
                            <td className="px-6 py-4 text-neutral-600">{customer.email}</td>
                            <td className="px-6 py-4">
                                <StatusBadge status={customer.status} />
                            </td>
                            <td className="px-6 py-4 text-neutral-600">{customer.orders}</td>
                            <td className="px-6 py-4 text-neutral-600">{customer.loyalty}</td>
                            <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center gap-3">
                                    <button className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                                        View
                                    </button>
                                    <button className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                                        Lock/Unlock
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const badgeStyles = {
    Active: "bg-emerald-100 text-emerald-700",
    Locked: "bg-rose-100 text-rose-700",
};

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status] ?? "bg-neutral-200 text-neutral-600"}`}>
        {status}
    </span>
);

export default AdminCustomers;
