import React from "react";

const stats = [
    { title: "Total Users", value: "24,832", change: "+12.5%", description: "vs last month" },
    { title: "Active Restaurants", value: "1,247", change: "+8.2%", description: "vs last month" },
    { title: "Total Orders", value: "156,932", change: "+15.3%", description: "vs last month" },
    { title: "Total Revenue", value: "$2.4M", change: "+18.7%", description: "vs last month" },
];

const recentCustomers = [
    { id: "CUS-1034", name: "Linh Tran", action: "Upgraded to Gold Tier", when: "2h ago", status: "Positive" },
    { id: "CUS-1098", name: "David Wong", action: "Reported delivery issue", when: "3h ago", status: "Warning" },
    { id: "CUS-1044", name: "Thao Nguyen", action: "Requested refund", when: "6h ago", status: "Critical" },
];

const systemServices = [
    { name: "API Gateway", status: "Operational", latency: "120ms", uptime: "99.99%" },
    { name: "Payment Service", status: "Degraded", latency: "350ms", uptime: "99.70%" },
    { name: "Notification Worker", status: "Operational", latency: "180ms", uptime: "100%" },
];

const activityLog = [
    { id: 1, actor: "Admin • Quyen", description: "Approved restaurant onboarding request", time: "Today · 09:31" },
    { id: 2, actor: "System", description: "Automated refund processed for order #84921", time: "Today · 08:12" },
    { id: 3, actor: "Moderator • Bao", description: "Locked customer account after fraud report", time: "Yesterday · 21:45" },
];

const AdminDashboard = () => (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold text-neutral-900">Overview Dashboard</h1>
            <p className="text-sm text-neutral-600">
                System-wide visibility into growth, performance, and current incidents.
            </p>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map(stat => (
                <div key={stat.title} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{stat.title}</p>
                    <p className="mt-3 text-2xl font-bold text-neutral-900">{stat.value}</p>
                    <p className="mt-2 text-xs font-semibold text-emerald-600">{stat.change}</p>
                    <p className="text-xs text-neutral-500">{stat.description}</p>
                </div>
            ))}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900">Recent Customer Activity</h2>
                        <p className="text-xs text-neutral-500">
                            Escalations and loyalty upgrades across the customer base.
                        </p>
                    </div>
                    <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                        View All
                    </button>
                </div>
                <ul className="mt-4 space-y-3">
                    {recentCustomers.map(entry => (
                        <li key={entry.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-neutral-800">{entry.name}</p>
                                    <p className="text-xs text-neutral-500">{entry.id}</p>
                                </div>
                                <StatusPill status={entry.status} />
                            </div>
                            <p className="mt-2 text-sm text-neutral-600">{entry.action}</p>
                            <p className="text-xs text-neutral-400 mt-1">{entry.when}</p>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900">System Status</h2>
                        <p className="text-xs text-neutral-500">Service health and uptime across core modules.</p>
                    </div>
                    <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                        Incident History
                    </button>
                </div>
                <ul className="mt-4 space-y-3">
                    {systemServices.map(service => (
                        <li key={service.name} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-neutral-800">{service.name}</p>
                                    <p className="text-xs text-neutral-500">Latency: {service.latency}</p>
                                </div>
                                <StatusPill status={service.status} />
                            </div>
                            <p className="text-xs text-neutral-400 mt-1">Uptime · {service.uptime}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">Activity Log</h2>
                <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                    Export
                </button>
            </div>
            <ul className="mt-4 space-y-3">
                {activityLog.map(log => (
                    <li key={log.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-neutral-800">{log.actor}</p>
                            <span className="text-xs text-neutral-500">{log.time}</span>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">{log.description}</p>
                    </li>
                ))}
            </ul>
        </section>
    </div>
);

const pillStyles = {
    Positive: "bg-emerald-100 text-emerald-700",
    Warning: "bg-amber-100 text-amber-700",
    Critical: "bg-rose-100 text-rose-700",
    Operational: "bg-emerald-100 text-emerald-700",
    Degraded: "bg-amber-100 text-amber-700",
};

const StatusPill = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${pillStyles[status] ?? "bg-neutral-200 text-neutral-600"}`}>
        {status}
    </span>
);

export default AdminDashboard;
