import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

const Settings = () => {
  const { user, logoutLocal, logoutAuth0 } = useAppContext();
  const [name, setName] = useState(user?.name || user?.fullName || '');
  const [email] = useState(user?.email || user?.emailAddresses?.[0]?.emailAddress || '');

  const saveProfile = (e) => {
    e.preventDefault();
    // TODO: call API to update profile when endpoint ready
  };

  return (
    <div className="max-padd-container py-16">
      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr,2fr]">
        <aside className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Account</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>Signed in as</li>
            <li className="font-semibold text-gray-900">{email || 'Guest'}</li>
          </ul>
          <button
            onClick={() => { logoutLocal?.(); logoutAuth0?.({ returnTo: window.location.origin }); }}
            className="mt-6 w-full rounded-full bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Logout
          </button>
        </aside>
        <section className="rounded-2xl bg-white p-6 shadow">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Profile settings</h1>
          <p className="mb-6 text-sm text-gray-600">Manage your personal information and preferences.</p>
          <form onSubmit={saveProfile} className="space-y-4">
            <label className="block text-sm text-gray-600">
              Full name
              <input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
            </label>
            <label className="block text-sm text-gray-600">
              Email
              <input value={email} disabled className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm" />
            </label>
            <div className="pt-2">
              <button type="submit" className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600">Save</button>
            </div>
          </form>
          <div className="mt-8 border-t pt-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Change password</h3>
            <form className="grid gap-3 md:grid-cols-2">
              <input type="password" placeholder="Current password" className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              <input type="password" placeholder="New password" className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              <input type="password" placeholder="Confirm new password" className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 md:col-span-2" />
              <div className="md:col-span-2">
                <button type="button" className="rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-500">Update password</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;

