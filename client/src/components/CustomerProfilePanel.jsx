import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import RatingStars from "./RatingStars";
import { assets } from "../assets/data";
import { useAppContext } from "../context/AppContext";

const ADDRESS_LABELS = [
  { id: "home", label: "Home" },
  { id: "company", label: "Office" },
  { id: "school", label: "School" },
  { id: "custom", label: "Other" },
];

const CustomerProfilePanel = ({ open, onClose, onLogout }) => {
  const {
    user,
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    addNewAddress,
    updateLocalProfile,
    removeAddress,
    bankAccounts,
    refreshBankAccounts,
    linkBankAccount,
    pastOrders,
    restaurantReviews,
    restaurants,
  } = useAppContext();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("profile");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressLabel, setAddressLabel] = useState(ADDRESS_LABELS[0].id);
  const [customLabel, setCustomLabel] = useState("");
  const defaultFullName =
    user?.fullName ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    addresses[0]?.recipient ||
    "FoodFast Customer";
  const defaultEmail =
    user?.email ||
    user?.emailAddresses?.[0]?.emailAddress ||
    user?.emails?.[0]?.emailAddress ||
    "";
  const defaultPhone = user?.phone || addresses[0]?.phone || "";

  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState(() => ({
    bankName: "",
    bankCode: "",
    accountHolder: defaultFullName,
    accountNumber: "",
    isDefault: bankAccounts.length === 0,
  }));
  const [savingBankAccount, setSavingBankAccount] = useState(false);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);

  const [profileForm, setProfileForm] = useState({
    fullName: defaultFullName,
    email: defaultEmail,
    phone: defaultPhone,
  });

  const [newAddress, setNewAddress] = useState({
    recipient: defaultFullName,
    phone: defaultPhone,
    street: "",
    ward: "",
    district: "",
    city: "Ho Chi Minh City",
    instructions: "",
    isDefault: false,
  });

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setProfileForm({
      fullName: defaultFullName,
      email: defaultEmail,
      phone: defaultPhone,
    });
  }, [defaultFullName, defaultEmail, defaultPhone, open]);

  useEffect(() => {
    setBankForm((prev) => ({
      ...prev,
      accountHolder: defaultFullName,
      isDefault: bankAccounts.length === 0 ? true : prev.isDefault,
    }));
  }, [defaultFullName, bankAccounts.length]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const loadAccounts = async () => {
      setLoadingBankAccounts(true);
      try {
        await refreshBankAccounts();
      } finally {
        if (!cancelled) {
          setLoadingBankAccounts(false);
        }
      }
    };
    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [open, refreshBankAccounts]);

  const normalize = (value) =>
    value
      ? value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
      : "";

  const userReviews = useMemo(() => {
    const normalizedName = normalize(defaultFullName);
    return restaurantReviews.filter(
      (review) => normalize(review.customerName) === normalizedName
    );
  }, [restaurantReviews, defaultFullName]);

  const groupedReviews = useMemo(() => {
    const map = new Map();
    userReviews.forEach((review) => {
      const list = map.get(review.restaurantId) || [];
      list.push(review);
      map.set(review.restaurantId, list);
    });
    return Array.from(map.entries()).map(([restaurantId, reviews]) => {
      const restaurant = restaurants.find((item) => item.id === restaurantId);
      const average =
        reviews.reduce((sum, item) => sum + (item.rating || 0), 0) /
        reviews.length;
      return { restaurant, reviews, average };
    });
  }, [userReviews, restaurants]);

  if (!open) return null;

  const toggleSection = (sectionId) => {
    setActiveSection((prev) => (prev === sectionId ? null : sectionId));
  };

  const handleProfileSave = () => {
    const nameParts = profileForm.fullName.trim().split(" ").filter(Boolean);
    const firstName = nameParts[0] || profileForm.fullName;
    const lastName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
    updateLocalProfile({
      first_name: firstName,
      last_name: lastName,
      fullName: profileForm.fullName,
      email: profileForm.email,
      phone: profileForm.phone,
    });
    setIsEditingProfile(false);
    toast.success("Profile updated.");
  };

  const handleAddAddress = async (event) => {
    event.preventDefault();
    if (!newAddress.street || !newAddress.ward || !newAddress.district) {
      toast.error("Please provide the complete address.");
      return;
    }
    const label =
      addressLabel === "custom"
        ? customLabel.trim() || "Other"
        : ADDRESS_LABELS.find((item) => item.id === addressLabel)?.label ||
          "Home";
    try {
      const created = await addNewAddress({
        label,
        recipient: newAddress.recipient || defaultFullName,
        phone: newAddress.phone || defaultPhone,
        street: newAddress.street,
        ward: newAddress.ward,
        district: newAddress.district,
        city: newAddress.city,
        instructions: newAddress.instructions,
        isDefault: newAddress.isDefault,
      });
      if (newAddress.isDefault && created?.id) {
        setSelectedAddressId(created.id);
      }
      toast.success("New address added.");
      setShowAddressForm(false);
      setNewAddress({
        recipient: defaultFullName,
        phone: defaultPhone,
        street: "",
        ward: "",
        district: "",
        city: "Ho Chi Minh City",
        instructions: "",
        isDefault: false,
      });
      setAddressLabel(ADDRESS_LABELS[0].id);
      setCustomLabel("");
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to save address.";
      toast.error(message);
    }
  };

  const handleBankFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setBankForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleRemoveAddress = async (addressId) => {
    try {
      await removeAddress(addressId);
      toast.success("Address removed.");
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to remove address.";
      toast.error(message);
    }
  };

  const handleBankSubmit = async (event) => {
    event.preventDefault();
    if (!bankForm.bankName.trim()) {
      toast.error("Please enter the bank name.");
      return;
    }
    if (!bankForm.accountHolder.trim()) {
      toast.error("Please enter the account holder name.");
      return;
    }
    if (!bankForm.accountNumber.trim()) {
      toast.error("Please enter the account number.");
      return;
    }
    setSavingBankAccount(true);
    try {
      await linkBankAccount({
        bankName: bankForm.bankName,
        bankCode: bankForm.bankCode,
        accountHolder: bankForm.accountHolder,
        accountNumber: bankForm.accountNumber,
        isDefault: bankForm.isDefault,
        user_id: user?.id,
      });
      toast.success("Bank account linked successfully.");
      setShowBankForm(false);
      setBankForm({
        bankName: "",
        bankCode: "",
        accountHolder: defaultFullName,
        accountNumber: "",
        isDefault: false,
      });
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to link bank account.";
      toast.error(message);
    } finally {
      setSavingBankAccount(false);
    }
  };

  const handleCancelBankForm = () => {
    setShowBankForm(false);
    setBankForm({
      bankName: "",
      bankCode: "",
      accountHolder: defaultFullName,
      accountNumber: "",
      isDefault: bankAccounts.length === 0,
    });
  };

  const renderProfileSection = () => (
    <div className="space-y-4 rounded-3xl bg-white p-6 shadow">
      <div className="flex items-start gap-4">
        <img
          src={assets.userImg}
          alt={profileForm.fullName}
          className="h-14 w-14 rounded-full border border-orange-100 object-cover"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {profileForm.fullName}
              </p>
              <p className="text-sm text-gray-500">{profileForm.phone}</p>
              <p className="text-xs text-gray-400">{profileForm.email}</p>
            </div>
            <button
              onClick={() => setIsEditingProfile((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-orange-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-orange-500 transition hover:border-orange-200"
            >
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              Chinh sua
            </button>
          </div>
          {isEditingProfile ? (
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleProfileSave();
              }}
            >
              <label className="text-xs font-semibold uppercase text-gray-500">
                Full name
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="text-xs font-semibold uppercase text-gray-500">
                Email
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="text-xs font-semibold uppercase text-gray-500">
                Phone number
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-orange-500 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-orange-600"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="rounded-full border border-orange-100 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:border-orange-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
      <button
        onClick={() => navigate("/auth/forgot-password")}
        className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:border-orange-200 hover:text-orange-500"
      >
        Reset password
      </button>
    </div>
  );

  const renderAddressSection = () => (
    <div className="space-y-4 rounded-3xl bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Delivery addresses
        </h3>
        <button
          onClick={() => setShowAddressForm((prev) => !prev)}
          className="rounded-full border border-dashed border-orange-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-orange-500 transition hover:bg-orange-50"
        >
          {showAddressForm ? "Close" : "Add address"}
        </button>
      </div>

      <div className="space-y-3">
        {addresses.map((address) => (
          <div
            key={address.id}
            className={`rounded-2xl border px-4 py-4 transition ${
              selectedAddressId === address.id
                ? "border-orange-400 bg-orange-50"
                : "border-orange-100 hover:border-orange-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={selectedAddressId === address.id}
                  onChange={() => setSelectedAddressId(address.id)}
                  className="h-4 w-4 text-orange-500 focus:ring-orange-400"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {address.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {address.recipient} - {address.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {address.isDefault ? (
                  <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Mac dinh
                  </span>
                ) : null}
                <button
                  onClick={() => handleRemoveAddress(address.id)}
                  className="rounded-full border border-orange-100 px-3 py-1 text-xs font-semibold text-gray-500 transition hover:border-red-200 hover:text-red-500"
                >
                  Xoa
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {address.street}, {address.ward}, {address.district},{" "}
              {address.city}
            </p>
            {address.instructions ? (
              <p className="text-xs text-orange-500">
                Ghi chu: {address.instructions}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {showAddressForm ? (
        <form
          onSubmit={handleAddAddress}
          className="space-y-3 rounded-3xl bg-orange-50/60 p-5"
        >
          <div className="flex flex-wrap gap-2">
            {ADDRESS_LABELS.map((label) => (
              <button
                type="button"
                key={label.id}
                onClick={() => setAddressLabel(label.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  addressLabel === label.id
                    ? "bg-orange-500 text-white"
                    : "bg-white text-gray-600 hover:bg-orange-100"
                }`}
              >
                {label.label}
              </button>
            ))}
          </div>
          {addressLabel === "custom" ? (
            <input
              type="text"
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              placeholder="Custom label name"
              className="w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-gray-500">
              Recipient
              <input
                type="text"
                value={newAddress.recipient}
                onChange={(event) =>
                  setNewAddress((prev) => ({
                    ...prev,
                    recipient: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-gray-500">
              Phone number
              <input
                type="tel"
                value={newAddress.phone}
                onChange={(event) =>
                  setNewAddress((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          <label className="text-xs font-semibold uppercase text-gray-500">
            Street / number
            <input
              type="text"
              value={newAddress.street}
              onChange={(event) =>
                setNewAddress((prev) => ({
                  ...prev,
                  street: event.target.value,
                }))
              }
              required
              className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold uppercase text-gray-500">
              Ward
              <input
                type="text"
                value={newAddress.ward}
                onChange={(event) =>
                  setNewAddress((prev) => ({
                    ...prev,
                    ward: event.target.value,
                  }))
                }
                required
                className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-gray-500">
              District
              <input
                type="text"
                value={newAddress.district}
                onChange={(event) =>
                  setNewAddress((prev) => ({
                    ...prev,
                    district: event.target.value,
                  }))
                }
                required
                className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-gray-500">
              City
              <input
                type="text"
                value={newAddress.city}
                onChange={(event) =>
                  setNewAddress((prev) => ({
                    ...prev,
                    city: event.target.value,
                  }))
                }
                required
                className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          <label className="text-xs font-semibold uppercase text-gray-500">
            Courier note
            <textarea
              value={newAddress.instructions}
              onChange={(event) =>
                setNewAddress((prev) => ({
                  ...prev,
                  instructions: event.target.value,
                }))
              }
              rows={2}
              className="mt-1 w-full rounded-2xl border border-orange-100 px-4 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
            <input
              type="checkbox"
              checked={newAddress.isDefault}
              onChange={(event) =>
                setNewAddress((prev) => ({
                  ...prev,
                  isDefault: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
            />
            Set as default address
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Save address
          </button>
        </form>
      ) : null}
    </div>
  );

  const renderPaymentSection = () => {
    const hasLinkedBank = bankAccounts.length > 0;
    return (
      <div className="space-y-4 rounded-3xl bg-white p-6 shadow">
        <p className="text-sm text-gray-500">
          Manage saved payment methods for faster checkout.
        </p>
        <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Connected bank accounts
              </p>
              <p className="text-xs text-gray-500">
                {hasLinkedBank
                  ? "Manage your linked accounts below."
                  : "Link a bank account to enable instant bank payments at checkout."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBankForm(true)}
              className="rounded-full border border-orange-300 px-3 py-1 text-xs font-semibold text-orange-500 transition hover:bg-orange-100"
            >
              + Add bank
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {loadingBankAccounts ? (
              <p className="text-xs text-gray-500">
                Loading linked accounts...
              </p>
            ) : hasLinkedBank ? (
              bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-xl border border-orange-100 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {account.bankName}
                      {account.isDefault ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      {account.accountHolder} • {account.accountNumberMasked}
                    </p>
                  </div>
                  {account.bankCode ? (
                    <span className="text-[10px] uppercase tracking-wide text-orange-500">
                      {account.bankCode}
                    </span>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">
                No bank accounts linked yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Connected debit / credit cards
              </p>
              <p className="text-xs text-gray-500">
                Securely store your cards to speed up future orders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast("Card linking is coming soon.")}
              className="rounded-full border border-orange-300 px-3 py-1 text-xs font-semibold text-orange-500 transition hover:bg-orange-100"
            >
              + Add card
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-500">No cards linked yet.</p>
          </div>
        </div>

        {showBankForm ? (
          <form
            onSubmit={handleBankSubmit}
            className="space-y-4 rounded-2xl border border-orange-100 bg-white p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Bank name
                </label>
                <input
                  name="bankName"
                  value={bankForm.bankName}
                  onChange={handleBankFieldChange}
                  placeholder="e.g. Vietcombank"
                  className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Bank code (optional)
                </label>
                <input
                  name="bankCode"
                  value={bankForm.bankCode}
                  onChange={handleBankFieldChange}
                  placeholder="VCB"
                  className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Account holder
                </label>
                <input
                  name="accountHolder"
                  value={bankForm.accountHolder}
                  onChange={handleBankFieldChange}
                  placeholder="Account holder name"
                  className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Account number
                </label>
                <input
                  name="accountNumber"
                  value={bankForm.accountNumber}
                  onChange={handleBankFieldChange}
                  placeholder="Enter digits only"
                  className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                name="isDefault"
                checked={bankForm.isDefault}
                onChange={handleBankFieldChange}
                className="h-4 w-4 rounded border-orange-200 text-orange-500 focus:ring-orange-300"
              />
              Set as default bank for checkout
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingBankAccount}
                className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingBankAccount ? "Linking..." : "Link bank account"}
              </button>
              <button
                type="button"
                onClick={handleCancelBankForm}
                className="rounded-full border border-orange-200 px-5 py-2 text-sm font-semibold text-orange-500 transition hover:bg-orange-100"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    );
  };

  const renderSupportSection = () => (
    <div className="space-y-3 rounded-3xl bg-white p-6 shadow">
      {[
        "Delayed order",
        "Wrong dish delivered",
        "Payment issue",
        "Other issue",
      ].map((issue) => (
        <button
          key={issue}
          onClick={() => toast(`Recorded: ${issue}. Our team will contact you shortly.`)}
          className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-left text-sm font-semibold text-gray-600 transition hover:border-orange-200 hover:text-orange-500"
        >
          {issue}
        </button>
      ))}
      <div className="rounded-2xl bg-orange-50/80 p-4">
        <p className="text-xs uppercase text-orange-500">Recent orders</p>
        <div className="mt-2 space-y-2 text-sm text-gray-600">
          {pastOrders.slice(0, 3).map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between"
            >
              <span>#{order.id}</span>
              <Link
                to="/orders/history"
                className="text-xs font-semibold text-orange-500"
                onClick={onClose}
              >
                Contact the restaurant
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPolicySection = () => (
    <div className="rounded-3xl bg-white p-6 shadow">
      <p className="text-sm text-gray-600">
        By continuing to use FoodFast, you agree to the{" "}
        <Link
          to="/terms"
          className="font-semibold text-orange-500 hover:underline"
          onClick={onClose}
        >
          terms of service
        </Link>{" "}
        and{" "}
        <Link
          to="/privacy"
          className="font-semibold text-orange-500 hover:underline"
          onClick={onClose}
        >
          privacy policy
        </Link>
        . We protect your information and only use it to deliver your orders.
      </p>
    </div>
  );

  const renderReviewSection = () => (
    <div className="space-y-4 rounded-3xl bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-gray-900">
            Your rating
          </h4>
          <p className="text-sm text-gray-500">
            All reviews you left after completing orders.
          </p>
        </div>
        <Link
          to="/orders/history"
          className="text-xs font-semibold uppercase tracking-wide text-orange-500"
          onClick={onClose}
        >
          View past orders
        </Link>
      </div>
      {groupedReviews.length ? (
        groupedReviews.map(({ restaurant, reviews, average }) => (
          <div
            key={restaurant?.id || reviews[0].restaurantId}
            className="space-y-3 rounded-2xl border border-orange-100 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {restaurant?.name || "Home hang"}
                </p>
                <p className="text-xs text-gray-400">
                  {reviews.length} reviews · {average.toFixed(1)} stars
                </p>
              </div>
              <RatingStars rating={average} />
            </div>
            <div className="space-y-2">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl bg-orange-50/80 p-3 text-sm text-gray-600"
                >
                  <p className="font-semibold text-gray-800">
                    {review.dishes?.map((dish) => dish.title).join(", ")}
                  </p>
                  <p>{review.comment}</p>
                  <p className="text-xs text-gray-400">
                    Ordered on{" "}
                    {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="rounded-2xl bg-orange-50/70 p-4 text-center text-sm text-gray-600">
          You have not submitted any reviews yet. Share your experience after completing an order.
          hang nhe!
        </p>
      )}
    </div>
  );

  const sections = [
    {
      id: "profile",
      title: "Customer information",
      description: "Update personal information and access your perks.",
      render: renderProfileSection,
    },
    {
      id: "addresses",
      title: "Delivery addresses",
      description: "Save multiple addresses and choose a default for next orders.",
      render: renderAddressSection,
    },
    {
      id: "payments",
      title: "Payments",
      description: "Link wallets or cards, or pay on delivery.",
      render: renderPaymentSection,
    },
    {
      id: "support",
      title: "Support",
      description: "Common issues and quick contact with restaurants.",
      render: renderSupportSection,
    },
    {
      id: "policy",
      title: "Terms & policies",
      description: "Learn how FoodFast protects your data and rights.",
      render: renderPolicySection,
    },
    {
      id: "reviews",
      title: "Review history",
      description: "Track the feedback you sent to restaurants.",
      render: renderReviewSection,
    },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative ml-auto flex h-full w-full max-w-[520px] flex-col bg-[#fffaf4]">
        <header className="flex items-center justify-between border-b border-orange-100 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-orange-400">
              Customer
            </p>
            <h2 className="text-lg font-bold text-gray-900">
              Your profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-orange-100 p-2 text-gray-500 transition hover:border-orange-300 hover:text-orange-500"
            aria-label="Close ho so"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {sections.map((section) => {
            const isOpen = activeSection === section.id;
            return (
              <div key={section.id} className="rounded-3xl bg-white shadow-sm">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between rounded-3xl bg-white px-5 py-4 text-left"
                >
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {section.title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {section.description}
                    </p>
                  </div>
                  <span className="text-lg text-orange-500">
                    {isOpen ? "-" : "+"}
                  </span>
                </button>
                {isOpen ? (
                  <div className="px-5 pb-5">{section.render()}</div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="border-t border-orange-100 px-6 py-5">
          <button
            onClick={() => {
              onLogout?.();
              onClose();
              toast("You have logged out.");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-orange-200 px-5 py-3 text-sm font-semibold text-orange-500 transition hover:bg-orange-50"
          >
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
};

export default CustomerProfilePanel;
