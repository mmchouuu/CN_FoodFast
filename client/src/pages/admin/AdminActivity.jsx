import React from "react";

const systemLog = [
    { id: 1, severity: "Info", message: "Scheduled health check completed for payment service.", time: "09:30" },
    { id: 2, severity: "Warning", message: "High latency detected on API gateway (p95 > 400ms).", time: "09:05" },
    { id: 3, severity: "Critical", message: "Database failover triggered for analytics cluster.", time: "08:47" },
];

const serviceStatus = [
    { name: "API Gateway", status: "Degraded", uptime: "99.70%", incidents: 2 },
    { name: "Database Cluster", status: "Operational", uptime: "99.98%", incidents: 0 },
    { name: "Notification Queue", status: "Operational", uptime: "100%", incidents: 0 },
];

const AdminActivity = () => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Activity Monitoring</h1>
                <p className="text-sm text-neutral-600">
                    Monitor system logs, service health, and infrastructure incidents across the platform.
                </p>
            </div>
            <div className="flex gap-3">
                <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
                    Download Logs
                </button>
                <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                    Create Alert
                </button>
            </div>
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-neutral-900">System Log</h2>
                    <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                        Filter
                    </button>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                    {systemLog.map(entry => (
                        <li key={entry.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <StatusPill status={entry.severity} />
                                <span className="text-xs text-neutral-500">{entry.time}</span>
                            </div>
                            <p className="mt-2 text-neutral-700">{entry.message}</p>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-neutral-900">Service Monitoring</h2>
                    <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                        Edit Thresholds
                    </button>
                </div>
                <table className="mt-4 w-full text-sm">
                    <thead className="text-left text-xs font-semibold uppercase text-neutral-500 tracking-wide">
                        <tr>
                            <th className="pb-2">Service</th>
                            <th className="pb-2">Status</th>
                            <th className="pb-2">Uptime</th>
                            <th className="pb-2">Incidents (30d)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {serviceStatus.map(service => (
                            <tr key={service.name}>
                                <td className="py-3 text-neutral-700">{service.name}</td>
                                <td className="py-3">
                                    <StatusPill status={service.status} />
                                </td>
                                <td className="py-3 text-neutral-600">{service.uptime}</td>
                                <td className="py-3 text-neutral-600">{service.incidents}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">Alerting Rules</h2>
                <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                    Manage Destinations
                </button>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                <li className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <p className="font-semibold text-neutral-800">Latency Spike Alert</p>
                    <p className="text-xs text-neutral-500 mt-1">
                        Trigger when API gateway latency &gt; 300ms for 5 minutes. Notify DevOps + PagerDuty.
                    </p>
                </li>
                <li className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <p className="font-semibold text-neutral-800">Error Rate Alert</p>
                    <p className="text-xs text-neutral-500 mt-1">
                        Trigger when payment service error ratio &gt; 2% for consecutive 10 minutes. Notify Finance.
                    </p>
                </li>
            </ul>
        </section>
    </div>
);

const badgeStyles = {
    Info: "bg-neutral-200 text-neutral-700",
    Warning: "bg-amber-100 text-amber-700",
    Critical: "bg-rose-100 text-rose-700",
    Operational: "bg-emerald-100 text-emerald-700",
    Degraded: "bg-amber-100 text-amber-700",
};

const StatusPill = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status] ?? "bg-neutral-200 text-neutral-600"}`}>
        {status}
    </span>
);

export default AdminActivity;
