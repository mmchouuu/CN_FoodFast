import React from "react";

const roleDefinitions = [
    { role: "Admin", permissions: ["Manage system settings", "View financial reports", "Approve restaurants"], users: 5 },
    { role: "Restaurant Owner", permissions: ["Manage restaurant profile", "Manage menu", "Manage staff"], users: 1247 },
    { role: "Customer", permissions: ["Place orders", "Submit reviews", "Manage account"], users: 24832 },
];

const pendingRequests = [
    { id: "REQ-3411", name: "Bao Nguyen", requestedRole: "Admin", reason: "Regional compliance oversight", submitted: "2 hours ago" },
    { id: "REQ-3404", name: "Mai Vo", requestedRole: "Restaurant Owner", reason: "New franchise onboarding", submitted: "1 day ago" },
];

const AdminAuthorization = () => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Account Authorization</h1>
                <p className="text-sm text-neutral-600">
                    Manage system roles, update permissions, and approve elevation requests.
                </p>
            </div>
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                Create Custom Role
            </button>
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {roleDefinitions.map(role => (
                <div key={role.role} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-neutral-900">{role.role}</h2>
                        <span className="text-xs font-semibold text-neutral-500">{role.users} users</span>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                        {role.permissions.map(permission => (
                            <li key={permission} className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                                {permission}
                            </li>
                        ))}
                    </ul>
                    <button className="mt-4 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                        Edit Permissions
                    </button>
                </div>
            ))}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Pending Authorization Requests</h2>
                    <p className="text-xs text-neutral-500">
                        Review justifications before approving privileged access.
                    </p>
                </div>
                <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                    View Audit Log
                </button>
            </header>
            <div className="divide-y divide-neutral-200">
                {pendingRequests.map(request => (
                    <article key={request.id} className="px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-neutral-900">
                                {request.name}
                                <span className="ml-2 text-xs font-medium text-neutral-500">{request.id}</span>
                            </p>
                            <p className="text-xs text-neutral-500 mt-1">Requested role: {request.requestedRole}</p>
                            <p className="mt-2 text-sm text-neutral-600 max-w-xl">{request.reason}</p>
                        </div>
                        <div className="flex flex-col gap-3 md:items-end">
                            <span className="text-xs text-neutral-500">{request.submitted}</span>
                            <div className="flex gap-2">
                                <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">
                                    Approve
                                </button>
                                <button className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 transition">
                                    Deny
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    </div>
);

export default AdminAuthorization;
