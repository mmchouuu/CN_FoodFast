import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { assets } from '../../assets/data';
import { Link, NavLink } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';

const Sidebar = () => {
  const { navigate, isOwner} = useAppContext();

  const navItems = [
    { path: '/owner', label: 'Dashboard', icon: assets.dashboard },
    { path: '/owner/profile', label: 'Restaurant Info', icon: assets.house },
    { path: '/owner/menu', label: 'Dish Management', icon: assets.list },
    { path: '/owner/orders', label: 'Order Management', icon: assets.graph },
    { path: '/owner/shippers', label: 'Shipper Management', icon: assets.delivery },
    { path: '/owner/assignments', label: 'Assign Orders', icon: assets.forward },
    { path: '/owner/tracking', label: 'Delivery Tracking', icon: assets.map },
    { path: '/owner/promotions', label: 'Promotions', icon: assets.badge },
    { path: '/owner/feedback', label: 'Customer Feedback', icon: assets.star },
    { path: '/owner/revenue', label: 'Revenue Statistics', icon: assets.dollar },
    { path: '/owner/account', label: 'Account Management', icon: assets.user },
  ];

  useEffect(() => {
    if (!isOwner) {
      navigate('/');
    }
  }, [isOwner, navigate]);

  return (
    <aside
      className="
        hidden md:flex 
        w-72 flex-shrink-0 flex-col 
        bg-white shadow-lg ring-1 ring-slate-200 
        h-screen 
        overflow-y-auto
      "
    >
      {/* Header cố định */}
      <div className="border-b border-slate-200 px-6 py-6 flex-none">
        <Link to="/" className="flex items-center gap-3">
          <img src={assets.logoImg} alt="Tasty Queen" className="h-12" />
          <div className="leading-tight">
            <p className="text-xl font-black text-slate-900">Tasty</p>
            <p className="text-xs font-semibold tracking-[0.4em] text-orange-500">Queen</p>
          </div>
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant Console</p>
        <p className="mt-1 text-sm text-slate-500">Monitor operations, menus, branches, and orders.</p>
      </div>

      {/* Nav có thể cuộn nếu dài */}
      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {navItems.map((link) => (
          <NavLink
            key={link.label}
            to={link.path}
            end={link.path === '/owner'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <img src={link.icon} alt={link.label} className="h-5 w-5" />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
