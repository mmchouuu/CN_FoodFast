import React from "react";
import { useAppContext } from "../context/AppContext";

const AuthPage = () => {
  const { isAuthenticated, user, loginWithRedirect, logoutAuth0 } =
    useAppContext();

  return (
    <div className="max-padd-container grid gap-10 py-28 lg:grid-cols-[1.3fr,1fr]">
      <section className="space-y-6 rounded-3xl bg-white p-10 shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900">
          {isAuthenticated ? "Welcome back" : "Login or create an account"}
        </h1>
        <p className="text-sm text-gray-500">
          Sign in to track orders, manage your profile, and unlock exclusive
          promotions tailored to your taste.
        </p>

        {isAuthenticated ? (
          <div className="rounded-3xl bg-orange-50 p-6 text-sm text-gray-700">
            <p className="text-lg font-semibold text-gray-900">
              {user?.fullName || user?.name || "FoodFast member"}
            </p>
            <p>{user?.emailAddresses?.[0]?.emailAddress || user?.email}</p>
            <button
              onClick={() => logoutAuth0?.({ returnTo: window.location.origin })}
              className="mt-6 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Email
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Password
                <input
                  type="password"
                  placeholder="********"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <button className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
                Login with email
              </button>
              <button className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500">
                Create an account
              </button>
            </div>

            <div className="relative border-t border-gray-200 pt-6">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs uppercase text-gray-400">
                or continue with
              </span>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => loginWithRedirect?.()}
                  className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500"
                >
                  Auth0
                </button>
                <button className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500">
                  Clerk
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="space-y-6 rounded-3xl bg-orange-500 p-10 text-white shadow-lg">
        <h2 className="text-2xl font-semibold">Benefits of joining FoodFast</h2>
        <ul className="space-y-4 text-sm">
          <li>- Track real-time delivery and keep a complete order history.</li>
          <li>- Save your favourite dishes and reorder in seconds.</li>
          <li>- Unlock members only promotions and flash deals.</li>
          <li>- Manage multiple delivery addresses effortlessly.</li>
        </ul>
        <p className="text-xs text-orange-100">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </aside>
    </div>
  );
};

export default AuthPage;
