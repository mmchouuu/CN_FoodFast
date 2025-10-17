import React, { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import restaurantAuth from "../../services/restaurantAuth";

const OTP_LENGTH = 6;

const RestaurantVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultEmail = location?.state?.email || "";
  const status = location?.state?.status || "waiting";

  const [email, setEmail] = useState(defaultEmail);
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputsRef = useRef([]);

  const otpValue = useMemo(() => otpDigits.join(""), [otpDigits]);

  const focusInput = (index) => {
    const input = inputsRef.current[index];
    if (input) {
      input.focus();
      input.select();
    }
  };

  const handleChangeDigit = (value, index) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      focusInput(index - 1);
    }
    if (event.key === "ArrowLeft" && index > 0) focusInput(index - 1);
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) focusInput(index + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("Mat khau nhap lai khong trung khop.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await restaurantAuth.verify({ email: email.trim(), otp: otpValue.trim(), password });
      toast.success("Xac thuc thanh cong. Vui long dang nhap.");
      navigate("/restaurant/auth/login", { replace: true, state: { email } });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Khong the xac thuc OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Xac thuc nha hang</h1>
        <p className="mb-4 text-sm text-gray-600">
          Sau khi admin duyet, ma OTP se duoc gui den email dang ky. Nhap OTP va tao mat khau de kich hoat tai khoan.
        </p>
        {status === "pending" ? (
          <div className="mb-4 rounded-2xl bg-orange-50 p-4 text-sm text-orange-600">
            Ho so dang cho admin duyet. Ban co the nhap ma OTP ngay khi nhan duoc email thong bao.
          </div>
        ) : null}
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={handleSubmit} className="space-y-6">
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
          <div>
            <p className="text-sm text-gray-600">Ma OTP</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputsRef.current[index] = node;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleChangeDigit(event.target.value, index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className="h-12 w-12 rounded-2xl border border-orange-100 text-center text-xl font-semibold text-gray-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              ))}
            </div>
          </div>
          <label className="block text-sm text-gray-600">
            Mat khau moi
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="block text-sm text-gray-600">
            Nhap lai mat khau
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <button
            type="submit"
            disabled={loading || otpValue.length !== OTP_LENGTH}
            className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? "Dang xac thuc..." : "Xac nhan OTP"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Can ho tro? <Link to="/restaurant/auth/register" className="font-semibold text-orange-500">Quay lai dang ky</Link>
        </p>
      </div>
    </div>
  );
};

export default RestaurantVerify;
