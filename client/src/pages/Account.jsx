import React from "react";
import { useAppContext } from "../context/AppContext";

const Account = () => {
  const { user, addresses, selectedAddressId, setSelectedAddressId } =
    useAppContext();

  return (
    <div className="max-padd-container space-y-10 py-24">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Account settings</h1>
        <p className="text-sm text-gray-500">
          Manage your personal information, delivery addresses, and security
          preferences.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Personal information
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Full name
                <input
                  type="text"
                  defaultValue={user?.fullName || user?.name || "Tran Minh Anh"}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Email
                <input
                  type="email"
                  defaultValue={user?.emailAddresses?.[0]?.emailAddress || ""}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Phone number
                <input
                  type="tel"
                  defaultValue="+84 909 111 222"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Preferred language
                <select className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                  <option>English</option>
                  <option>Vietnamese</option>
                </select>
              </label>
            </div>
            <button className="mt-6 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
              Save changes
            </button>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Change password
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Current password
                <input
                  type="password"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                New password
                <input
                  type="password"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </div>
            <button className="mt-6 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-700">
              Update password
            </button>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Delivery addresses
            </h2>
            <div className="mt-6 space-y-4">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-5 text-sm transition ${
                    selectedAddressId === address.id
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-orange-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="default-address"
                        checked={selectedAddressId === address.id}
                        onChange={() => setSelectedAddressId(address.id)}
                        className="h-4 w-4 text-orange-500 focus:ring-orange-400"
                      />
                      <span className="text-xs font-semibold uppercase text-gray-400">
                        {address.label}
                      </span>
                    </div>
                    {address.isDefault ? (
                      <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="text-base font-semibold text-gray-900">
                    {address.recipient}
                  </p>
                  <p className="text-sm text-gray-500">{address.phone}</p>
                  <p className="text-sm text-gray-600">
                    {address.street}, {address.ward}, {address.district},{" "}
                    {address.city}
                  </p>
                  {address.instructions ? (
                    <p className="text-xs text-orange-500">
                      {address.instructions}
                    </p>
                  ) : null}
                </label>
              ))}
            </div>
            <button className="mt-4 w-full rounded-full border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-500 transition hover:border-orange-300 hover:text-orange-500">
              Add new address
            </button>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Security alerts
            </h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                />
                Email me when my password changes
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                />
                Notify me about new devices
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                />
                Monthly account summary
              </label>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default Account;
