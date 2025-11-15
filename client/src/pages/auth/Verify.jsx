import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

const OTP_LENGTH = 6;
const RESEND_DELAY_SECONDS = 5 * 60;

const Verify = () => {
  const { verifyOtp, resendSignupOtp } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const defaultEmail = location?.state?.email || "";
  const defaultUserId = location?.state?.userId || (() => {
    try {
      return localStorage.getItem("pending_user_id");
    } catch {
      return null;
    }
  })();

  const [email, setEmail] = useState(defaultEmail);
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("pending_otp_sent_at"));
      if (stored) {
        const elapsed = Math.floor((Date.now() - stored) / 1000);
        if (elapsed < RESEND_DELAY_SECONDS) {
          return RESEND_DELAY_SECONDS - elapsed;
        }
      }
    } catch {
      // ignore reading failures
    }
    return 0;
  });
  const inputsRef = useRef([]);

  const otpValue = useMemo(() => otpDigits.join(""), [otpDigits]);
  const cooldownLabel = useMemo(() => {
    if (cooldown <= 0) return "Ready";
    const minutes = String(Math.floor(cooldown / 60)).padStart(2, "0");
    const seconds = String(cooldown % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [cooldown]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const focusInput = (index) => {
    const input = inputsRef.current[index];
    if (input) {
      input.focus();
      input.select();
    }
  };

  const handleChange = (value, index) => {
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
    if (event.key === "ArrowLeft" && index > 0) {
      focusInput(index - 1);
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await verifyOtp(email.trim(), otpValue.trim());
      const resolvedUserId =
        result?.user?.id ||
        defaultUserId ||
        null;
      if (resolvedUserId) {
        try {
          localStorage.setItem("pending_user_id", resolvedUserId);
        } catch {
          // ignore storage issues
        }
      }
      navigate("/auth/add-address", {
        replace: true,
        state: { email: email.trim(), userId: resolvedUserId },
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to verify the OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError("");
    try {
      await resendSignupOtp(email.trim());
      setCooldown(RESEND_DELAY_SECONDS);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to resend OTP at the moment."
      );
    } finally {
      setResendLoading(false);
    }
  };

  const canResend = cooldown <= 0 && !resendLoading;

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Verify your email
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Enter the 6-digit code we just sent to your email to activate your account.
        </p>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={onSubmit} className="space-y-6">
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
            <p className="text-sm text-gray-600">OTP code</p>
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
                  onChange={(event) => handleChange(event.target.value, index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className="h-12 w-12 rounded-2xl border border-orange-100 text-center text-xl font-semibold text-gray-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Didn't get the code?</span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={!canResend}
              className={`font-semibold ${
                canResend ? "text-orange-500 hover:underline" : "text-gray-400"
              }`}
            >
              {canResend
                ? "Resend OTP"
                : `Resend in ${cooldownLabel}`}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || otpValue.length !== OTP_LENGTH}
            className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Continue"}
          </button>
        </form>
        <div className="mt-4 text-right text-sm">
          <Link to="/auth/login" className="text-gray-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Verify;
