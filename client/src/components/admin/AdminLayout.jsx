import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import GradientBackgrounds from "./GradientBackgrounds";

const navItems = [
    { path: "/admin", label: "Overview Dashboard" },
    { path: "/admin/customers", label: "Customer Management" },
    { path: "/admin/restaurants", label: "Restaurant Management" },
    { path: "/admin/authorization", label: "Account Authorization" },
    { path: "/admin/complaints", label: "Complaint Management" },
    { path: "/admin/promotions", label: "System Promotions" },
    { path: "/admin/activity", label: "Activity Monitoring" },
];

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="relative min-h-screen bg-neutral-50 text-neutral-800">
            <GradientBackgrounds />
            <div className="flex min-h-screen">
                <aside
                    className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-neutral-200 bg-white shadow-sm transition-transform duration-200 ease-in-out md:translate-x-0 md:shadow-none overflow-y-auto ${
                        sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                >
                    <div className="p-6 flex items-center justify-between md:block">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-base font-semibold text-neutral-900">Admin Console</p>
                                <p className="text-xs text-neutral-500">System oversight</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="rounded-md p-2 text-neutral-500 hover:text-neutral-800 md:hidden"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <span className="sr-only">Close menu</span>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <nav className="px-4 pb-6">
                        <div className="space-y-2">
                            {navItems.map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.path === "/admin"}
                                    className={({ isActive }) =>
                                        `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                            isActive
                                                ? "bg-neutral-900 text-white shadow-sm"
                                                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                                        }`
                                    }
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    </nav>
                </aside>

                <div className="flex flex-1 flex-col md:ml-64">
                    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
                        <div className="flex items-center justify-between px-4 py-4 md:px-6">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-600 shadow-sm hover:text-neutral-900 md:hidden"
                                    onClick={() => setSidebarOpen(true)}
                                >
                                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    Menu
                                </button>
                                <div>
                                    <p className="text-lg font-semibold text-neutral-900">System Administration</p>
                                    <p className="text-xs text-neutral-500">Monitor health, roles, and escalations</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900">
                                    Refresh
                                </button>
                                <div className="h-9 w-9 rounded-full bg-gradient-to-r from-neutral-400 to-neutral-600" />
                            </div>
                        </div>
                    </header>
                    <main className="flex-1 px-4 py-6 md:px-6">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;
