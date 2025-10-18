import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import restaurantAuth from "../../services/restaurantAuth";

const OTP_LENGTH = 6;

const STATUS_DESCRIPTIONS = {
  pending:
    "Your registration is being reviewed. We will notify you via email once an admin approves your profile.",
  approve:
    "An admin has approved your restaurant. Check your email for the 6-digit OTP and activation password to continue.",
  active: "Your restaurant account is active. You can sign in with your credentials.",
  approved:
    "This restaurant has already confirmed but is currently locked. Contact the admin team for further assistance.",
  warning:
    "Your restaurant is active but flagged with a warning. Review your recent activity or contact support if needed.",
  not_found: "We couldn't find a restaurant registration for this email. Please double-check or create a new request.",
};

const RestaurantVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultEmail = location?.state?.email || "";
  const defaultStatus = location?.state?.status || "pending";

  const [email, setEmail] = useState(defaultEmail);
  const [restaurantStatus, setRestaurantStatus] = useState(defaultStatus);
  const [step, setStep] = useState(
    defaultStatus === "approve" ? "collect" : defaultStatus === "active" ? "completed" : "summary",
  );
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [activationPassword, setActivationPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showActivationPassword, setShowActivationPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inputsRef = useRef([]);

  const otpValue = useMemo(() => otpDigits.join(""), [otpDigits]);

  const adjustStep = (nextStatus) => {
    if (nextStatus === "approve") {
      setStep((previous) => (previous === "password" ? "password" : "collect"));
    } else if (nextStatus === "active") {
      setStep("completed");
    } else {
      setStep("summary");
    }
  };

  const fetchStatus = async (targetEmail) => {
    const lookupEmail = (targetEmail !== undefined ? targetEmail : email).trim();
    if (!lookupEmail) {
      setStatusError("Please enter the email used during registration.");
      return;
    }
    if (targetEmail !== undefined) {
      setEmail(lookupEmail);
    }

    setStatusLoading(true);
    setStatusError("");
    try {
      const data = await restaurantAuth.status(lookupEmail);
      const nextStatus = data.restaurantStatus || "pending";
      setRestaurantStatus(nextStatus);
      adjustStep(nextStatus);
      if (nextStatus === "approve") {
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setActivationPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError("");
        setSuccessMessage("");
      }
      if (nextStatus === "active") {
        setSuccessMessage("Your restaurant account is active. You can sign in now.");
      }
    } catch (err) {
      setStatusError(
        err?.response?.data?.message || err?.message || "Unable to check the current status right now.",
      );
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (defaultEmail) {
      fetchStatus(defaultEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmail]);

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
    if (value && index < otpDigits.length - 1) {
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
    if (event.key === "ArrowRight" && index < otpDigits.length - 1) {
      focusInput(index + 1);
    }
  };

  const handleCollectSubmit = (event) => {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (otpValue.length !== OTP_LENGTH) {
      setError("Please enter the full 6-digit OTP.");
      return;
    }
    if (!activationPassword.trim()) {
      setError("Activation password is required.");
      return;
    }
    setStep("password");
  };

  const handleVerificationSubmit = async (event) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      setError("New password must contain at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await restaurantAuth.verify({
        email: email.trim(),
        otp: otpValue.trim(),
        activationPassword: activationPassword.trim(),
        newPassword,
      });
      toast.success("Verification successful. Sign in with your new password.");
      setRestaurantStatus("active");
      adjustStep("active");
      setSuccessMessage("Verification successful. You can now sign in.");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to verify the OTP right now.");
    } finally {
      setLoading(false);
    }
  };

  const statusDescription = STATUS_DESCRIPTIONS[restaurantStatus] || "Request not found. Double-check the email above.";

  const renderContent = () => {
    if (!email.trim()) {
      return (
        <p className="rounded-3xl border border-orange-100 bg-orange-50 p-6 text-sm text-orange-700">
          Enter your registered email above and select “Check status” to continue.
        </p>
      );
    }

    if (restaurantStatus === "pending") {
      return (
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-6 text-sm text-gray-700">
          <p>{statusDescription}</p>
          <p className="mt-3">
            Once approved, we will email you the OTP and activation password that allow you to activate the account.
          </p>
        </div>
      );
    }

    if (restaurantStatus === "approve" && (step === "collect" || step === "password")) {
      return (
        <div className="space-y-6">
          <div className="rounded-3xl border border-orange-100 bg-orange-50 p-6 text-sm text-gray-700">
            <p>{statusDescription}</p>
            <p className="mt-3">
              OTP codes expire in 5 minutes. You will be prompted to choose a new password after submitting the OTP and
              activation password.
            </p>
          </div>

          {step === "collect" ? (
            <form onSubmit={handleCollectSubmit} className="space-y-6">
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <label className="text-sm text-gray-600">
                Activation password
                <div className="mt-1 flex items-center rounded-xl border border-orange-100 px-4 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100">
                  <input
                    type={showActivationPassword ? "text" : "password"}
                    value={activationPassword}
                    onChange={(event) => setActivationPassword(event.target.value)}
                    required
                    className="w-full border-none py-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowActivationPassword((prev) => !prev)}
                    className="text-xs font-semibold uppercase tracking-wide text-orange-500"
                  >
                    {showActivationPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              <div>
                <p className="text-sm text-gray-600">OTP code (6 digits)</p>
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
              <button
                type="submit"
                className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerificationSubmit} className="space-y-6">
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-gray-600">
                  New password
                  <div className="mt-1 flex items-center rounded-xl border border-orange-100 px-4 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      minLength={6}
                      required
                      className="w-full border-none py-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="text-xs font-semibold uppercase tracking-wide text-orange-500"
                    >
                      {showNewPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <label className="text-sm text-gray-600">
                  Confirm password
                  <div className="mt-1 flex items-center rounded-xl border border-orange-100 px-4 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={6}
                      required
                      className="w-full border-none py-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="text-xs font-semibold uppercase tracking-wide text-orange-500"
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep("collect");
                    setError("");
                  }}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Set new password"}
                </button>
              </div>
            </form>
          )}
        </div>
      );
    }

    if (restaurantStatus === "active" || step === "completed") {
      return (
        <div className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-sm text-emerald-700">
          <p>{successMessage || statusDescription}</p>
          <button
            type="button"
            onClick={() => navigate("/restaurant/auth/login", { replace: true, state: { email } })}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Go to sign in
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700">
        <p>{statusDescription}</p>
      </div>
    );
  };

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Restaurant Verification</h1>
        <p className="mb-6 text-sm text-gray-600">
          Use the OTP and activation password we emailed after approval to activate your restaurant account.
        </p>

        <div className="space-y-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-6">
          <label className="text-sm text-gray-600">
            Registered email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="restaurant@example.com"
              className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <StatusBadge status={restaurantStatus} />
            <button
              type="button"
              onClick={() => fetchStatus()}
              disabled={statusLoading || !email.trim()}
              className="rounded-full bg-orange-500 px-5 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {statusLoading ? "Checking..." : "Check status"}
            </button>
          </div>
          {statusError ? <p className="text-xs text-red-600">{statusError}</p> : null}
        </div>

        <div className="mt-6 space-y-6">{renderContent()}</div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Need help?{" "}
          <Link to="/restaurant/auth/register" className="font-semibold text-orange-500">
            Update registration details
          </Link>
        </p>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Pending admin review
        </span>
      );
    case "approve":
      return (
        <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
          Awaiting activation
        </span>
      );
    case "active":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Active
        </span>
      );
    case "approved":
      return (
        <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
          Locked
        </span>
      );
    case "warning":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Warning
        </span>
      );
    case "not_found":
      return (
        <span className="inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
          Not found
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
          Unknown
        </span>
      );
  }
};

export default RestaurantVerify;
