import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import restaurantAuth from "../../services/restaurantAuth";

const RestaurantLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultEmail = location?.state?.email || "";

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await restaurantAuth.login({ email: email.trim(), password });
      toast.success("Dang nhap thanh cong.");
      if (data?.token) {
        localStorage.setItem("restaurant_token", data.token);
      }
      navigate("/owner", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Khong the dang nhap nha hang.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Dang nhap nha hang</h1>
        <p className="mb-6 text-sm text-gray-600">
          Nhap email da xac thuc va mat khau de truy cap bang dieu khien nha hang.
        </p>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-gray-600">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="block text-sm text-gray-600">
            Mat khau
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? "Dang dang nhap..." : "Dang nhap"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Chua co tai khoan? <Link to="/restaurant/auth/register" className="font-semibold text-orange-500">Dang ky ngay</Link>
        </p>
      </div>
    </div>
  );
};

export default RestaurantLogin;
