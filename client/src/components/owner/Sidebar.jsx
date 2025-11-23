import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { assets } from '../../assets/data';
import { Link, NavLink } from 'react-router-dom';
import useOwnerPermission from '../../hooks/useOwnerPermission';

const NAV_CONFIG = [
  { path: '/owner', label: 'Dashboard', icon: assets.dashboard, roles: ['owner_main', 'owner', 'manager'] },
  { path: '/owner/profile', label: 'Restaurant Info', icon: assets.house, roles: ['owner_main', 'owner', 'manager', 'staff'] },
  { path: '/owner/menu', label: 'Dish Management', icon: assets.list, permissions: ['canManageMenu'] },
  { path: '/owner/orders', label: 'Order Management', icon: assets.graph, permissions: ['canManageOrders'], roles: ['owner_main', 'owner', 'manager', 'staff'] },
  { path: '/owner/settlements', label: 'Settlement Reports', icon: assets.secure, permissions: ['canManageFinance'] },
  { path: '/owner/tracking', label: 'Delivery Tracking', icon: assets.map, roles: ['owner_main', 'owner', 'manager', 'staff'] },
  { path: '/owner/promotions', label: 'Promotions', icon: assets.badge, roles: ['owner_main', 'owner'] },
  { path: '/owner/feedback', label: 'Customer Feedback', icon: assets.star, roles: ['owner_main', 'owner', 'manager', 'staff'] },
  { path: '/owner/revenue', label: 'Revenue Statistics', icon: assets.dollar, permissions: ['canManageFinance'], roles: ['owner_main', 'owner', 'manager'] },
  { path: '/owner/account', label: 'Account Management', icon: assets.user, permissions: ['canManageStaff'], roles: ['owner_main', 'owner', 'manager'] },
];

const Sidebar = ({
  onCollapseChange,
  mobileOpen,
  onMobileOpenChange,
  showInternalMobileButton = true,
}) => {
  const { navigate, isOwner } = useAppContext();
  const { hasRequirement } = useOwnerPermission();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isMobileControlled = typeof mobileOpen === 'boolean';
  const currentMobileOpen = isMobileControlled ? mobileOpen : sidebarOpen;
  const setMobileOpen = (value) => {
    if (!isMobileControlled) {
      setSidebarOpen(value);
    }
    if (typeof onMobileOpenChange === 'function') {
      onMobileOpenChange(value);
    }
  };

  const navItems = useMemo(
    () =>
      NAV_CONFIG.filter((item) =>
        hasRequirement({ roles: item.roles, permissions: item.permissions }),
      ),
    [hasRequirement],
  );

  useEffect(() => {
    if (!isOwner) {
      navigate('/');
    }
  }, [isOwner, navigate]);

  useEffect(() => {
    if (typeof onCollapseChange === 'function') {
      onCollapseChange(sidebarCollapsed);
    }
  }, [onCollapseChange, sidebarCollapsed]);

  return (
    <>
      {/* Mobile Menu Button */}
      {showInternalMobileButton && (
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed top-4 left-4 z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Overlay for mobile */}
      {currentMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative
          inset-y-0 left-0 z-50
          flex flex-col 
          bg-white shadow-lg ring-1 ring-slate-200 
          h-screen 
          overflow-y-auto
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'md:w-20' : 'md:w-72'}
          ${currentMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-6 flex-none">
          <div className="flex items-center justify-between">
            <Link to="/" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <img src={assets.logoImg} alt="Tasty Queen" className="h-12" />
              {!sidebarCollapsed && (
                <div className="leading-tight">
                  <p className="text-xl font-black text-slate-900">Tasty</p>
                  <p className="text-xs font-semibold tracking-[0.4em] text-orange-500">Queen</p>
                </div>
              )}
            </Link>
            
            {/* Close button for mobile */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden rounded-md p-2 text-slate-500 hover:text-slate-800"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant Console</p>
              <p className="mt-1 text-sm text-slate-500">Monitor operations, menus, branches, and orders.</p>
            </>
          )}
        </div>

        {/* Collapse Toggle Button - Desktop only */}
        <div className={`px-4 py-2 border-b border-slate-200 hidden md:block ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center gap-2"
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

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {navItems.map((link) => (
            <NavLink
              key={link.label}
              to={link.path}
              end={link.path === '/owner'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
              title={sidebarCollapsed ? link.label : ''}
            >
              <img src={link.icon} alt={link.label} className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{link.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
