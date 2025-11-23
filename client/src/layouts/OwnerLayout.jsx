import React, { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/owner/Sidebar';
import OwnerHeader from '../components/owner/OwnerHeader';
import useOwnerPermission from '../hooks/useOwnerPermission';

const ROUTE_RULES = [
  { pattern: /^\/owner\/profile/i, requirements: { roles: ['owner_main', 'owner', 'manager', 'staff'] } },
  { pattern: /^\/owner\/menu/i, requirements: { permissions: ['canManageMenu'] } },
  { pattern: /^\/owner\/orders/i, requirements: { permissions: ['canManageOrders'], roles: ['owner_main', 'owner', 'manager', 'staff'] } },
  { pattern: /^\/owner\/settlements/i, requirements: { permissions: ['canManageFinance'] } },
  { pattern: /^\/owner\/cash-settlement/i, requirements: { permissions: ['canManageFinance'] } },
  { pattern: /^\/owner\/shippers/i, requirements: { permissions: ['canManageStaff'], roles: ['owner_main', 'owner'] } },
  { pattern: /^\/owner\/assignments/i, requirements: { permissions: ['canManageOrders'], roles: ['owner_main', 'owner', 'manager'] } },
  { pattern: /^\/owner\/tracking/i, requirements: { roles: ['owner_main', 'owner', 'manager', 'staff'] } },
  { pattern: /^\/owner\/promotions/i, requirements: { roles: ['owner_main', 'owner'] } },
  { pattern: /^\/owner\/feedback/i, requirements: { roles: ['owner_main', 'owner', 'manager', 'staff'] } },
  { pattern: /^\/owner\/revenue/i, requirements: { permissions: ['canManageFinance'], roles: ['owner_main', 'owner', 'manager'] } },
  { pattern: /^\/owner\/account/i, requirements: { permissions: ['canManageStaff'], roles: ['owner_main', 'owner', 'manager'] } },
];

const UnauthorizedView = () => (
  <div className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-orange-700">
    <p className="text-base font-semibold text-slate-900">You do not have access to this area.</p>
    <p className="mt-2 text-slate-600">
      Please contact the owner main of your restaurant to request the appropriate permissions.
    </p>
  </div>
);

const OwnerLayout = () => {
  const location = useLocation();
  const { hasRequirement } = useOwnerPermission();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const allowed = useMemo(() => {
    const pathname = location.pathname || '';
    const matchedRule = ROUTE_RULES.find((rule) => rule.pattern.test(pathname));
    if (!matchedRule) {
      return hasRequirement(null);
    }
    return hasRequirement(matchedRule.requirements);
  }, [hasRequirement, location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside
        className={`${sidebarCollapsed ? 'md:w-20' : 'md:w-72'} w-0 flex-shrink-0 h-screen overflow-y-auto bg-white shadow-lg ring-1 ring-slate-200 transition-all duration-300`}
      >
        <Sidebar
          onCollapseChange={setSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
          showInternalMobileButton={false}
        />
      </aside>
      <div className="flex flex-1 flex-col h-screen overflow-y-auto">
        <OwnerHeader onMenuToggle={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 px-3 pb-10 pt-4 md:px-8">
          {allowed ? <Outlet /> : <UnauthorizedView />}
        </main>
      </div>
    </div>
  );
};

export default OwnerLayout;

