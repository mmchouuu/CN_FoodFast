import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/owner/Sidebar';
import OwnerHeader from '../components/owner/OwnerHeader';

const OwnerLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar cố định và cuộn độc lập */}
      <aside className="hidden md:flex w-72 flex-shrink-0 h-screen overflow-y-auto bg-white shadow-lg ring-1 ring-slate-200">
        <Sidebar />
      </aside>

      {/* Nội dung bên phải cuộn riêng */}
      <div className="flex flex-1 flex-col h-screen overflow-y-auto">
        <OwnerHeader />
        <main className="flex-1 px-3 pb-10 pt-4 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default OwnerLayout;
