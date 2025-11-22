import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import RatingStars from "./RatingStars";
import { assets } from "../assets/data";
import { useAppContext } from "../context/AppContext";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getStripe } from "../lib/stripe";

const ADDRESS_LABELS = [
  { id: "home", label: "Home" },
  { id: "company", label: "Office" },
  { id: "school", label: "School" },
  { id: "custom", label: "Other" },
];

const stripePromise = getStripe();

const CustomerProfilePanel = ({ open, onClose, onLogout }) => {
  const {
    user,
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    addNewAddress,
    updateLocalProfile,
    removeAddress,
    momoWallets,
    refreshMomoWallets,
    linkMomoWallet,
    cardAccounts,
    createStripeSetupIntent,
    linkCard,
    refreshCardAccounts,
    removeCard,
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

  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletForm, setWalletForm] = useState(() => ({
    walletName: defaultFullName,
    phoneNumber: "",
    walletId: "",
    isDefault: momoWallets.length === 0,
  }));
  const [savingWallet, setSavingWallet] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardForm, setCardForm] = useState(() => ({
    cardholderName: defaultFullName,
    isDefault: cardAccounts.length === 0,
  }));

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
    if (!open) {
      setShowWalletForm(false);
      setShowCardForm(false);
    }
  }, [open]);

  useEffect(() => {
    setProfileForm({
      fullName: defaultFullName,
      email: defaultEmail,
      phone: defaultPhone,
    });
  }, [defaultFullName, defaultEmail, defaultPhone, open]);

  useEffect(() => {
    setWalletForm((prev) => ({
      ...prev,
      walletName: defaultFullName,
      isDefault: momoWallets.length === 0 ? true : prev.isDefault,
    }));
  }, [defaultFullName, momoWallets.length]);

  useEffect(() => {
    setCardForm((prev) => ({
      cardholderName: prev.cardholderName || defaultFullName,
      isDefault: cardAccounts.length === 0 ? true : prev.isDefault,
    }));
  }, [defaultFullName, cardAccounts.length]);

  useEffect(() => {
    if (!open || typeof refreshCardAccounts !== "function") return;
    let isMounted = true;
    setLoadingCards(true);
    refreshCardAccounts()
      .catch((error) => {
        console.error("Failed to refresh cards", error);
      })
      .finally(() => {
        if (isMounted) setLoadingCards(false);
      });
    return () => {
      isMounted = false;
    };
  }, [open, refreshCardAccounts]);

  useEffect(() => {
    setCardForm((prev) => ({
      ...prev,
      cardholderName: defaultFullName,
      isDefault: cardAccounts.length === 0 ? true : prev.isDefault,
    }));
  }, [defaultFullName, cardAccounts.length]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const loadWallets = async () => {
      setLoadingWallets(true);
      try {
        await refreshMomoWallets();
      } finally {
        if (!cancelled) {
          setLoadingWallets(false);
        }
      }
    };
    loadWallets();
    return () => {
      cancelled = true;
    };
  }, [open, refreshMomoWallets]);

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

  const handleWalletFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setWalletForm((prev) => ({
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

  const handleWalletSubmit = async (event) => {
    event.preventDefault();
    if (!walletForm.walletName.trim()) {
      toast.error("Please enter the MoMo account name.");
      return;
    }
    if (!walletForm.phoneNumber.trim()) {
      toast.error("Please provide the registered MoMo phone number.");
      return;
    }
    setSavingWallet(true);
    try {
      await linkMomoWallet({
        walletName: walletForm.walletName,
        phoneNumber: walletForm.phoneNumber,
        walletId: walletForm.walletId,
        isDefault: walletForm.isDefault,
        user_id: user?.id,
      });
      toast.success("MoMo wallet linked successfully.");
      setShowWalletForm(false);
      setWalletForm({
        walletName: defaultFullName,
        phoneNumber: "",
        walletId: "",
        isDefault: momoWallets.length === 0,
      });
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to link MoMo wallet.";
      toast.error(message);
    } finally {
      setSavingWallet(false);
    }
  };

  const handleCardLinkSuccess = () => {
    setShowCardForm(false);
    setCardForm({
      cardholderName: defaultFullName,
      isDefault: false,
    });
  };

  const handleCancelWalletForm = () => {
    setShowWalletForm(false);
    setWalletForm({
      walletName: defaultFullName,
      phoneNumber: "",
      walletId: "",
      isDefault: momoWallets.length === 0,
    });
  };

  const handleCancelCardForm = () => {
    setShowCardForm(false);
    setCardForm({
      cardholderName: defaultFullName,
      isDefault: cardAccounts.length === 0,
    });
  };

  const handleRemoveCard = (cardId) => {
    try {
      removeCard?.(cardId);
      toast.success("Card removed.");
    } catch (error) {
      const message = error?.message || "Unable to remove card.";
      toast.error(message);
    }
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
                  Delete
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
    const hasLinkedWallet = momoWallets.length > 0;
    const hasLinkedCard = cardAccounts.length > 0;
    return (
      <div className="space-y-4 rounded-3xl bg-white p-6 shadow">
        <p className="text-sm text-gray-500">
          Manage saved payment methods for faster checkout.
        </p>
        <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Connected MoMo wallets
              </p>
              <p className="text-xs text-gray-500">
                {hasLinkedWallet
                  ? "Manage the wallet you trust for fast MoMo checkouts."
                  : "Link your MoMo wallet to enjoy one-tap, secure payments."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowWalletForm((prev) => !prev);
                setShowCardForm(false);
              }}
              className="rounded-full border border-orange-300 px-3 py-1 text-xs font-semibold text-orange-500 transition hover:bg-orange-100"
            >
              {showWalletForm ? "Close" : "+ Add wallet"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {loadingWallets ? (
              <p className="text-xs text-gray-500">
                Loading linked wallets...
              </p>
            ) : hasLinkedWallet ? (
              momoWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between rounded-xl border border-orange-100 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {wallet.walletName || "MoMo Wallet"}
                      {wallet.isDefault ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      {wallet.maskedPhone || wallet.phoneNumber || "Phone not set"}
                      {wallet.walletId ? ` • ID ${wallet.walletId}` : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">
                No MoMo wallets linked yet.
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
              onClick={() => {
                setShowCardForm((prev) => !prev);
      setShowWalletForm(false);
              }}
              className="rounded-full border border-orange-300 px-3 py-1 text-xs font-semibold text-orange-500 transition hover:bg-orange-100"
            >
              {showCardForm ? "Close" : "+ Add card"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {loadingCards ? (
              <p className="text-xs text-gray-500">Loading saved cards...</p>
            ) : hasLinkedCard ? (
              cardAccounts.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-xl border border-orange-100 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {(card.brand || "Card").toUpperCase()} •••• {card.last4 || "----"}
                      {card.isDefault ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      Exp {card.expMonth || "--"}/{card.expYear || "--"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {typeof removeCard === "function" ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(card.id)}
                        className="text-xs font-semibold text-gray-400 transition hover:text-red-500"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">No cards linked yet.</p>
            )}
          </div>
        </div>

        {showWalletForm ? (
          <form
            onSubmit={handleWalletSubmit}
            className="space-y-4 rounded-2xl border border-orange-100 bg-white p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Account name
                </label>
                <input
                  name="walletName"
                  value={walletForm.walletName}
                  onChange={handleWalletFieldChange}
                  placeholder="MoMo account holder"
                  className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  MoMo phone number
                </label>
                <input
                  name="phoneNumber"
                  value={walletForm.phoneNumber}
                  onChange={handleWalletFieldChange}
                  placeholder="090 123 4567"
                  inputMode="tel"
                  className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  MoMo wallet ID (optional)
                </label>
                <input
                  name="walletId"
                  value={walletForm.walletId}
                  onChange={handleWalletFieldChange}
                  placeholder="Reference / wallet ID"
                  className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                name="isDefault"
                checked={walletForm.isDefault}
                onChange={handleWalletFieldChange}
                className="h-4 w-4 rounded border-orange-200 text-orange-500 focus:ring-orange-300"
              />
              Set as default wallet for checkout
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingWallet}
                className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingWallet ? "Linking..." : "Link MoMo wallet"}
              </button>
              <button
                type="button"
                onClick={handleCancelWalletForm}
                className="rounded-full border border-orange-200 px-5 py-2 text-sm font-semibold text-orange-500 transition hover:bg-orange-100"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {showCardForm ? (
          <Elements stripe={stripePromise}>
            <StripeCardLinkForm
              cardForm={cardForm}
              setCardForm={setCardForm}
              defaultEmail={defaultEmail}
              savingCard={savingCard}
              setSavingCard={setSavingCard}
              createStripeSetupIntent={createStripeSetupIntent}
              linkStripeCard={linkCard}
              onSuccess={handleCardLinkSuccess}
              onCancel={handleCancelCardForm}
            />
          </Elements>
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
                  {review.ownerReply ? (
                    <div className="mt-2 rounded-lg bg-white/80 p-3 text-xs text-gray-600">
                      <p className="font-semibold text-gray-800">Restaurant replied</p>
                      <p className="mt-1">{review.ownerReply}</p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {review.ownerReplyAt
                          ? new Date(review.ownerReplyAt).toLocaleString("vi-VN")
                          : "Recently"}
                      </p>
                    </div>
                  ) : null}
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

const cardElementStyles = {
  style: {
    base: {
      fontSize: "15px",
      color: "#1f2933",
      "::placeholder": {
        color: "#9ca3af",
      },
      fontFamily: '"Inter", system-ui, sans-serif',
    },
    invalid: {
      color: "#ef4444",
    },
  },
  hidePostalCode: true,
};

function StripeCardLinkForm({
  cardForm,
  setCardForm,
  defaultEmail,
  savingCard,
  setSavingCard,
  createStripeSetupIntent,
  linkStripeCard,
  onSuccess,
  onCancel,
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) {
      toast.error("Payment form is not ready yet. Please try again in a moment.");
      return;
    }

    if (!cardForm.cardholderName.trim()) {
      toast.error("Please enter the cardholder's name.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast.error("Unable to access the secure card field.");
      return;
    }

    setSavingCard(true);
    try {
      const setupIntent = await createStripeSetupIntent();
      if (!setupIntent?.client_secret || !setupIntent?.customer_id) {
        throw new Error("Unable to initialise Stripe setup intent.");
      }

      const confirmation = await stripe.confirmCardSetup(setupIntent.client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardForm.cardholderName,
            email: defaultEmail || undefined,
          },
        },
      });

      if (confirmation.error) {
        throw new Error(confirmation.error.message || "Card verification failed.");
      }

      const paymentMethodId = confirmation.setupIntent?.payment_method;
      if (!paymentMethodId) {
        throw new Error("Stripe did not return a payment method id.");
      }

      await linkStripeCard({
        paymentMethodId,
        customerId: setupIntent.customer_id,
        isDefault: cardForm.isDefault,
      });

      toast.success("Card added successfully.");
      if (typeof onSuccess === "function") {
        onSuccess();
      }
      cardElement.clear();
    } catch (error) {
      const message = error?.message || "Unable to link card.";
      toast.error(message);
    } finally {
      setSavingCard(false);
    }
  };

  const handleCardholderChange = (event) => {
    setCardForm((prev) => ({
      ...prev,
      cardholderName: event.target.value,
    }));
  };

  const handleDefaultToggle = (event) => {
    setCardForm((prev) => ({
      ...prev,
      isDefault: event.target.checked,
    }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-orange-100 bg-white p-4"
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Cardholder name
          </label>
          <input
            name="cardholderName"
            value={cardForm.cardholderName}
            onChange={handleCardholderChange}
            placeholder="e.g. PHAM NGUYEN MINH CHAU"
            className="w-full rounded-xl border border-orange-100 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Card details
          </label>
          <div className="rounded-xl border border-orange-100 px-3 py-3">
            <CardElement options={cardElementStyles} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            name="isDefault"
            checked={cardForm.isDefault}
            onChange={handleDefaultToggle}
            className="h-4 w-4 rounded border-orange-200 text-orange-500 focus:ring-orange-300"
          />
          Set as default card for checkout
        </label>
        <p className="text-[10px] text-gray-400">
          Card details are securely tokenised by Stripe. FoodFast never stores full card numbers or CVV codes.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={savingCard || !stripe || !elements}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingCard ? "Linking..." : "Add card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-orange-200 px-5 py-2 text-sm font-semibold text-orange-500 transition hover:bg-orange-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
