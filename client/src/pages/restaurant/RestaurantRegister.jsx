import React, { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import restaurantAuth from "../../services/restaurantAuth";

const initialState = {
  restaurantName: "",
  companyAddress: "",
  taxCode: "",
  managerName: "",
  phone: "",
  email: "",
};

const RestaurantRegister = () => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await restaurantAuth.register(form);
      toast.success("Ho so da duoc tiep nhan. Vui long doi admin duyet.");
      navigate("/restaurant/auth/verify", {
        state: { email: form.email, status: "pending" },
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Khong the dang ky nha hang.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Dang ky nha hang</h1>
        <p className="mb-6 text-sm text-gray-600">
          Vui long nhap thong tin chinh xac. Admin se xem xet va gui OTP xac thuc qua email.
        </p>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-gray-600">
            Ten nha hang
            <input
              name="restaurantName"
              type="text"
              value={form.restaurantName}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="block text-sm text-gray-600">
            Dia chi cong ty
            <textarea
              name="companyAddress"
              value={form.companyAddress}
              onChange={handleChange}
              rows={3}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-gray-600">
              Ma so thue
              <input
                name="taxCode"
                type="text"
                value={form.taxCode}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="block text-sm text-gray-600">
              Nguoi quan tri
              <input
                name="managerName"
                type="text"
                value={form.managerName}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-gray-600">
              So dien thoai lien he
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="block text-sm text-gray-600">
              Email dang ky
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? "Dang gui thong tin..." : "Gui yeu cau dang ky"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Da co tai khoan? <button onClick={() => navigate("/restaurant/auth/login")} className="font-semibold text-orange-500">Dang nhap</button>
        </p>
      </div>
    </div>
  );
};

export default RestaurantRegister;
