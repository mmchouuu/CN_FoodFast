import React from "react";

const disputes = [
    { id: "CMP-2045", orderId: "#84921", customer: "David Wong", restaurant: "Pho Master", reason: "Delivery issue", status: "Investigating", submitted: "Apr 15, 09:12" },
    { id: "CMP-2046", orderId: "#84955", customer: "Linh Tran", restaurant: "Lotus Vegan", reason: "Refund request", status: "Refund Issued", submitted: "Apr 15, 08:03" },
    { id: "CMP-2041", orderId: "#84770", customer: "Huong Ly", restaurant: "Saigon Street Bites", reason: "Missing items", status: "Awaiting Evidence", submitted: "Apr 14, 19:55" },
];

const AdminComplaints = () => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Complaint Management</h1>
                <p className="text-sm text-neutral-600">
                    Review dispute tickets, coordinate refunds, and keep both customers and restaurants informed.
                </p>
            </div>
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                Create Ticket
            </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Open Complaints" value="28" detail="8 require admin action" />
            <MetricCard label="Refunded Today" value="$1,280" detail="12 orders compensated" />
            <MetricCard label="SLA Compliance" value="92%" detail="Within 48h resolution" />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Active Disputes</h2>
                    <p className="text-xs text-neutral-500">Sort by priority to ensure timely resolution.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        All
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Awaiting Evidence
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Refund Issued
                    </button>
                </div>
            </header>
            <div className="divide-y divide-neutral-200">
                {disputes.map(ticket => (
                    <article key={ticket.id} className="px-6 py-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
                        <div>
                            <p className="text-sm font-semibold text-neutral-900">{ticket.customer}</p>
                            <p className="text-xs text-neutral-500">{ticket.id} · {ticket.orderId}</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-neutral-800">{ticket.restaurant}</p>
                            <p className="text-xs text-neutral-500">{ticket.reason}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <StatusBadge status={ticket.status} />
                            <span className="text-xs text-neutral-500">{ticket.submitted}</span>
                        </div>
                        <div className="flex items-start justify-end gap-2">
                            <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition">
                                View Details
                            </button>
                            <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">
                                Resolve
                            </button>
                        </div>
                    </article>
                ))}
            </div>
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
    Investigating: "bg-amber-100 text-amber-700",
    "Refund Issued": "bg-emerald-100 text-emerald-700",
    "Awaiting Evidence": "bg-neutral-200 text-neutral-600",
};

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status] ?? "bg-neutral-200 text-neutral-600"}`}>
        {status}
    </span>
);

export default AdminComplaints;
