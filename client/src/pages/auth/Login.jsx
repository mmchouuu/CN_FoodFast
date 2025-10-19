import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

const Login = () => {
  const { loginWithCredentials } = useAppContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const rememberedCredentials = localStorage.getItem("foodfast_remembered_login");
    if (rememberedCredentials) {
      try {
        const parsed = JSON.parse(rememberedCredentials);
        if (parsed.email) {
          setEmail(parsed.email);
        }
        if (parsed.password) {
          let decoded = parsed.password;
          if (typeof atob === "function") {
            try {
              decoded = atob(parsed.password);
            } catch {
              decoded = parsed.password;
            }
          }
          setPassword(decoded);
        }
        setRememberMe(true);
        return;
      } catch {
        localStorage.removeItem("foodfast_remembered_login");
      }
    }
    const legacyEmail = localStorage.getItem("foodfast_remembered_email");
    if (legacyEmail) {
      setEmail(legacyEmail);
      setRememberMe(true);
    }
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginWithCredentials(email.trim(), password);
      if (rememberMe) {
        let encodedPassword = password;
        if (typeof btoa === "function") {
          try {
            encodedPassword = btoa(password);
          } catch {
            encodedPassword = password;
          }
        }
        const payload = {
          email: email.trim(),
          password: encodedPassword,
        };
        localStorage.setItem("foodfast_remembered_login", JSON.stringify(payload));
        localStorage.removeItem("foodfast_remembered_email");
      } else {
        localStorage.removeItem("foodfast_remembered_login");
        localStorage.removeItem("foodfast_remembered_email");
      }
      navigate("/");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to log in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Welcome back
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Log in to track orders, save addresses, and unlock member-only offers.
        </p>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm text-gray-600">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="block text-sm text-gray-600">
            Password
            <div className="mt-1 flex items-center rounded-xl border border-orange-100 px-4 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full border-none py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-xs font-semibold uppercase tracking-wide text-orange-500"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
              Remember me
            </label>
            <Link
              to="/auth/forgot-password"
              className="font-semibold text-orange-500 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Log in"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link to="/auth/signup" className="font-semibold text-orange-500">
            Create one now
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
