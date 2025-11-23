import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import adminService from "../../services/admin";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accountType, setAccountType] = useState("System Administrator");

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("admin_login_email");
      const savedAccountType = localStorage.getItem("admin_account_type");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
      if (savedAccountType) {
        setAccountType(savedAccountType);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        email: email.trim(),
        password,
        rememberMe,
        accountType,
      };
      const result = await adminService.login(payload);
      if (result?.token) {
        localStorage.setItem("admin_token", result.token);
      }
      if (result?.user) {
        localStorage.setItem("admin_profile", JSON.stringify(result.user));
      }
      if (rememberMe) {
        localStorage.setItem("admin_login_email", payload.email);
        localStorage.setItem("admin_account_type", accountType);
      } else {
        localStorage.removeItem("admin_login_email");
        localStorage.removeItem("admin_account_type");
      }
      window.dispatchEvent(new CustomEvent("admin:auth-changed"));
      toast.success(result?.message || "Welcome back.");
      // Redirect based on selected accountType unless redirected explicitly
      let redirectTo = location.state?.redirect;
      if (!redirectTo) {
        redirectTo = accountType === "Drone Operations Manager" ? "/admin/drone-hubs" : "/admin";
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to sign in right now."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-10 shadow-xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-400">
            FoodFast Console
          </p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">
            Admin Sign In
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Access customer, restaurant, and promotion controls.
          </p>
        </div>
        {error ? (
          <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-medium text-neutral-600">
            Account type
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 bg-white"
            >
              <option>System Administrator</option>
              <option>Drone Operations Manager</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-neutral-600">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            />
          </label>
          <label className="block text-sm font-medium text-neutral-600">
            Password
            <div className="mt-2 flex items-center rounded-2xl border border-neutral-200 px-4 focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-100">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full border-none py-3 text-neutral-900 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-xs font-semibold uppercase tracking-wider text-orange-500"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
            />
            Remember this account on this device
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-neutral-400">
          Secure access · FoodFast platform team only
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
