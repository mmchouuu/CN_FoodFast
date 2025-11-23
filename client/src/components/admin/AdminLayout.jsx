import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

const navItems = [
    { path: "/admin", label: "Overview Dashboard" },
    { path: "/admin/customers", label: "Customer Management" },
    { path: "/admin/restaurants", label: "Restaurant Management" },
    { path: "/admin/payouts", label: "Payout Management" },
    { path: "/admin/cod-settlements", label: "COD Settlements" },
    { path: "/admin/drone-hubs", label: "Drone Hub Management" },
    { path: "/admin/assignments", label: "Assign Orders" },
    { path: "/admin/delivery-tracking", label: "Delivery Tracking" },
    { path: "/admin/maintenance", label: "Drone Maintenance" },
    { path: "/admin/authorization", label: "Account Authorization" },
    { path: "/admin/complaints", label: "Complaint Management" },
    { path: "/admin/promotions", label: "System Promotions" },
    { path: "/admin/activity", label: "Activity Monitoring" },
];

const DRONE_FEATURE_PATHS = new Set([
    "/admin/drone-hubs",
    "/admin/assignments",
    "/admin/delivery-tracking",
    "/admin/maintenance",
]);

const getStoredAdminProfile = () => {
    try {
        const raw = localStorage.getItem('admin_profile');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [token, setToken] = useState(() => {
        try {
            return localStorage.getItem('admin_token');
        } catch {
            return null;
        }
    });
    const [profile, setProfile] = useState(() => getStoredAdminProfile());

    useEffect(() => {
        const syncAuth = () => {
            try {
                setToken(localStorage.getItem('admin_token'));
                setProfile(getStoredAdminProfile());
            } catch {
                setToken(null);
                setProfile(null);
            }
        };
        window.addEventListener('storage', syncAuth);
        window.addEventListener('admin:auth-changed', syncAuth);
        window.addEventListener('admin:expired', syncAuth);
        return () => {
            window.removeEventListener('storage', syncAuth);
            window.removeEventListener('admin:auth-changed', syncAuth);
            window.removeEventListener('admin:expired', syncAuth);
        };
    }, []);

    const initials = useMemo(() => {
        if (!profile?.full_name) return 'AD';
        const parts = profile.full_name.split(' ').filter(Boolean);
        if (!parts.length) return 'AD';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }, [profile]);

    const filteredNavItems = useMemo(() => {
        if (!profile?.role) {
            return navItems;
        }
        if (profile.role === 'drone_operator') {
            return navItems.filter((item) => DRONE_FEATURE_PATHS.has(item.path));
        }
        if (profile.role === 'admin') {
            return navItems.filter((item) => !DRONE_FEATURE_PATHS.has(item.path));
        }
        return navItems;
    }, [profile]);

    const handleLogout = () => {
        try {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_profile');
        } catch {
            // ignore
        }
        window.dispatchEvent(new CustomEvent('admin:auth-changed'));
        navigate('/admin/login');
    };

    if (!token) {
        return <Navigate to="/admin/login" state={{ redirect: location.pathname + location.search }} replace />;
    }

    return (
        <div className="relative min-h-screen bg-neutral-50 text-neutral-800">
            <div className="flex min-h-screen">
                {/* Sidebar */}
                <aside
                    className={`fixed inset-y-0 left-0 z-40 border-r border-neutral-200 bg-white shadow-sm transition-all duration-300 ease-in-out overflow-y-auto ${
                        sidebarCollapsed ? 'w-16' : 'w-64'
                    } ${
                        sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    } md:translate-x-0 md:shadow-none`}
                >
                    <div className={`p-6 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} md:block`}>
                        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white flex-shrink-0">
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            {!sidebarCollapsed && (
                                <div>
                                    <p className="text-base font-semibold text-neutral-900">Admin Console</p>
                                    <p className="text-xs text-neutral-500">System oversight</p>
                                </div>
                            )}
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

                    {/* Collapse Toggle Button - Desktop only */}
                    <div className={`px-4 pb-2 hidden md:block ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 flex items-center justify-center gap-2"
                            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            <svg 
                                className={`h-4 w-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {!sidebarCollapsed && <span>Collapse</span>}
                        </button>
                    </div>

                    <nav className="px-4 pb-6">
                        <div className="space-y-2">
                            {filteredNavItems.map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.path === "/admin"}
                                    className={({ isActive }) =>
                                        `flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                            isActive
                                                ? "bg-neutral-900 text-white shadow-sm"
                                                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                                        }`
                                    }
                                    onClick={() => setSidebarOpen(false)}
                                    title={sidebarCollapsed ? item.label : ''}
                                >
                                    {sidebarCollapsed ? (
                                        <span className="text-xs font-bold">{item.label.charAt(0)}</span>
                                    ) : (
                                        <span>{item.label}</span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </nav>
                </aside>

                {/* Main Content */}
                <div className={`flex flex-1 flex-col transition-all duration-300 ${
                    sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
                }`}>
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
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
                                >
                                    Sign out
                                </button>
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-neutral-400 to-neutral-600 text-sm font-semibold text-white">
                                    {initials}
                                </div>
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
