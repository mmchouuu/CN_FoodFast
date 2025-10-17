import React from "react";

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const staffAccounts = [
    { id: "staff-01", name: "Le Quyen", role: "Manager", lastLogin: "2025-04-15 09:12", status: "Active" },
    { id: "staff-02", name: "Tran Minh", role: "Cashier", lastLogin: "2025-04-14 21:02", status: "Active" },
    { id: "staff-03", name: "Nguyen Hai", role: "Supervisor", lastLogin: "2025-04-13 17:48", status: "Suspended" },
];

const AccountManagement = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Account Management</h1>
                    <p className="text-sm text-slate-600">
                        Update restaurant owner credentials and authorize management staff roles.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
                        View Activity Log
                    </button>
                    <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                        Add Staff Account
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Owner Credentials</h2>
                    <form className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Email
                            </label>
                            <input
                                type="email"
                                defaultValue="owner@tastyqueen.vn"
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                                />
                            </div>
                        </div>
                        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                            Update Credentials
                        </button>
                    </form>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Security Settings</h2>
                    <div className="flex flex-col gap-4">
                        <SecurityToggle
                            title="Two-factor authentication"
                            description="Require OTP code when managers sign in from new devices."
                            defaultChecked
                        />
                        <SecurityToggle
                            title="Auto logout"
                            description="Automatically sign out users after 30 minutes of inactivity."
                            defaultChecked
                        />
                        <SecurityToggle
                            title="Restrict IP ranges"
                            description="Allow account access only from whitelisted locations."
                        />
                    </div>
                </div>
            </section>

            <section className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left uppercase text-xs font-medium text-slate-500 tracking-wide">
                        <tr>
                            <th className="px-6 py-4">Staff</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Last Login</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {staffAccounts.map(account => (
                            <tr key={account.id} className="hover:bg-slate-50/80">
                                <td className="px-6 py-4">
                                    <p className="font-semibold text-slate-800">{account.name}</p>
                                    <p className="text-xs text-slate-500">#{account.id}</p>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{account.role}</td>
                                <td className="px-6 py-4 text-slate-600">{account.lastLogin}</td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={account.status} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="inline-flex items-center gap-3">
                                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                            Edit
                                        </button>
                                        <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
                                            Reset Password
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

const SecurityToggle = ({ title, description, defaultChecked = false }) => (
    <label className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <input type="checkbox" defaultChecked={defaultChecked} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
        <span>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
        </span>
    </label>
);

const badgeStyles = {
    Active: "bg-emerald-100 text-emerald-700",
    Suspended: "bg-red-100 text-red-600",
};

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status] ?? "bg-slate-100 text-slate-600"}`}>
        {status}
    </span>
);

export default AccountManagement;
