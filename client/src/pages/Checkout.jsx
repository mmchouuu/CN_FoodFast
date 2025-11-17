import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const normalizePaymentMethodForSubmit = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "cod";
  if (normalized === "wallet" || normalized === "cod" || normalized === "cash" || normalized === "cash_on_delivery") {
    return "cod";
  }
  if (normalized === "bank") {
    return "bank_transfer";
  }
  if (normalized === "bank_transfer") {
    return "bank_transfer";
  }
  if (normalized === "credit" || normalized === "debit") {
    return "card";
  }
  return normalized;
};

const getActivePaymentOptionId = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "";
  if (normalized === "cod" || normalized === "cash" || normalized === "cash_on_delivery") {
    return "wallet";
  }
  if (normalized === "bank_transfer") {
    return "bank";
  }
  return normalized;
};

const Checkout = () => {

  const {
    getCartAmount,
    delivery_charges,
    getDiscountAmount,
    applyDiscountCode,
    appliedDiscountCode,
    momoWallets,
    cardAccounts,
    selectedCardId,
    setSelectedCardId,
    method,
    setMethod,
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    selectedAddress,
    currency,
    placeOrder,
    addNewAddress,
    openCustomerProfilePanel,
    isAuthenticated,
  } = useAppContext();

  const [discountCode, setDiscountCode] = useState(
    appliedDiscountCode?.code || ""
  );
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "home",
    customLabel: "",
    recipient: "",
    phone: "",
    street: "",
    ward: "",
    district: "",
    city: "Ho Chi Minh City",
    instructions: "",
    isDefault: false,
  });
  const addressLabels = [
    { id: "home", label: "Home" },
    { id: "company", label: "Office" },
    { id: "school", label: "School" },
    { id: "custom", label: "Other" },
  ];
  const navigate = useNavigate();
  const activePaymentMethodId = useMemo(
    () => getActivePaymentOptionId(method),
    [method],
  );

  const subtotal = getCartAmount();
  const discount = getDiscountAmount(subtotal);
  const shippingFee = subtotal === 0 ? 0 : delivery_charges;
  const total = Math.max(subtotal + shippingFee - discount, 0);

  const isCartEmpty = useMemo(() => subtotal === 0, [subtotal]);
  const hasMomoWallet = momoWallets.length > 0;
  const hasCardAccount = cardAccounts.length > 0;
  const hasSavedPaymentMethod = hasMomoWallet || hasCardAccount;
  const methodRequiresWallet = method === "wallet";
  const methodRequiresCard = method === "card";
  const paymentSelectionInvalid =
    !hasSavedPaymentMethod ||
    (methodRequiresWallet && !hasMomoWallet) ||
    (methodRequiresCard && !hasCardAccount);

  const paymentMethods = useMemo(
    () => [
      {
        id: "wallet",
        label: "MoMo wallet",
        description: "Pay via your linked MoMo wallet for instant confirmation.",
      },
      {
        id: "card",
        label: "Debit/Credit card",
        description: "Pay securely with your saved cards.",
      },
    ],
    [],
  );

  const getCardLabel = (card) => {
    const brand = (card.brand || "CARD").toUpperCase();
    const last4 = card.last4 || card.providerData?.last4 || "0000";
    return `${brand} •••• ${last4}`;
  };

  const getCardExpiry = (card) => {
    const expMonth = card.expMonth ?? card.exp_month;
    const expYear = card.expYear ?? card.exp_year;
    if (!expMonth || !expYear) return null;
    const paddedMonth = String(expMonth).padStart(2, "0");
    const shortYear = String(expYear).slice(-2);
    return `${paddedMonth}/${shortYear}`;
  };

  const handleApplyDiscount = () => {
    applyDiscountCode(discountCode);
  };

  const handlePlaceOrder = async () => {
    if (isCartEmpty) {
      toast.error("Your cart is currently empty.");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Please sign in before placing an order.");
      openCustomerProfilePanel();
      return;
    }
    if (!hasSavedPaymentMethod) {
      toast.error("Link a MoMo wallet or add a card before paying.");
      openCustomerProfilePanel();
      return;
    }
    if (methodRequiresWallet && !hasMomoWallet) {
      toast.error("Link a MoMo wallet to use this payment method.");
      openCustomerProfilePanel();
      return;
    }
    if (methodRequiresCard && !hasCardAccount) {
      toast.error("Add a debit/credit card to use this payment method.");
      openCustomerProfilePanel();
      return;
    }
    if (!selectedAddress) {
      toast.error("Please choose a delivery address first.");
      return;
    }
    const paymentMethodForSubmit = normalizePaymentMethodForSubmit(method);
    try {
      setIsPlacingOrder(true);
      const createdOrder = await placeOrder({
        paymentMethod: paymentMethodForSubmit,
        address: selectedAddress,
      });
      const firstOrder = Array.isArray(createdOrder)
        ? createdOrder[0]
        : createdOrder;
      toast.success("Order successful");
      if (firstOrder?.id) {
        navigate("/orders/current", { state: { orderId: firstOrder.id } });
      } else {
        navigate("/orders/current");
      }
    } catch (error) {
      const message =
        error?.message || "We could not place your order. Please try again.";
      toast.error(message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleAddAddress = async (event) => {
    event.preventDefault();
    if (!newAddress.street || !newAddress.ward || !newAddress.district) {
      toast.error("Please complete the street, ward, and district fields.");
      return;
    }
    const matchedLabel = addressLabels.find(
      (item) => item.id === newAddress.label
    );
    const label =
      newAddress.label === "custom"
        ? newAddress.customLabel?.trim() || "Other"
        : matchedLabel?.label || "Home";
    try {
      const created = await addNewAddress({
        label,
        recipient: newAddress.recipient || "Customer",
        phone: newAddress.phone || "",
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
        label: "home",
        customLabel: "",
        recipient: "",
        phone: "",
        street: "",
        ward: "",
        district: "",
        city: "TP. Ho Chi Minh",
        instructions: "",
        isDefault: false,
      });
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to save address.";
      toast.error(message);
    }
  };

  return (
    <div className="max-padd-container grid gap-10 py-24 lg:grid-cols-2">
      <section className="space-y-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Delivery address
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose where to receive this order.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <button
                key={address.id}
                onClick={() => setSelectedAddressId(address.id)}
                className={`flex h-full flex-col rounded-2xl border p-5 text-left transition ${
                  selectedAddressId === address.id
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 hover:border-orange-300"
                }`}
              >
                <span className="text-sm font-semibold uppercase text-gray-400">
                  {address.label}
                </span>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {address.recipient}
                </p>
                <p className="text-sm text-gray-500">{address.phone}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {address.street}, {address.ward}, {address.district},{" "}
                  {address.city}
                </p>
                {address.instructions ? (
                  <p className="mt-2 text-xs text-orange-500">
                    {address.instructions}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-4">
            <button
              onClick={() => setShowAddressForm((prev) => !prev)}
              className="rounded-full border border-dashed border-orange-300 px-5 py-2 text-sm font-semibold text-orange-500 transition hover:bg-orange-50"
            >
              {showAddressForm ? "Cancel" : "+ Add a new address"}
            </button>
            {showAddressForm ? (
              <form
                onSubmit={handleAddAddress}
                className="space-y-4 rounded-3xl bg-orange-50/60 p-6"
              >
                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase text-gray-500">
                  {addressLabels.map((labelOption) => (
                    <button
                      type="button"
                      key={labelOption.id}
                      onClick={() =>
                        setNewAddress((prev) => ({
                          ...prev,
                          label: labelOption.id,
                        }))
                      }
                      className={`rounded-full px-4 py-2 transition ${
                        newAddress.label === labelOption.id
                          ? "bg-orange-500 text-white"
                          : "bg-white text-gray-600 hover:bg-orange-100"
                      }`}
                    >
                      {labelOption.label}
                    </button>
                  ))}
                </div>
                {newAddress.label === "custom" ? (
                  <input
                    type="text"
                    value={newAddress.customLabel}
                    onChange={(event) =>
                      setNewAddress((prev) => ({
                        ...prev,
                        customLabel: event.target.value,
                      }))
                    }
                    placeholder="Name this label (e.g., Parents' home)"
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
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
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
                </div>
                <label className="text-xs font-semibold uppercase text-gray-500">
                  Street / House number
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
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-3">
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
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
                </div>
                <label className="text-xs font-semibold uppercase text-gray-500">
                  Driver instructions (optional)
                  <textarea
                    value={newAddress.instructions}
                    onChange={(event) =>
                      setNewAddress((prev) => ({
                        ...prev,
                        instructions: event.target.value,
                      }))
                    }
                    rows={2}
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                  Make default address
                </label>
                <button
                  type="submit"
                  className="w-full rounded-full bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Save address
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Payment method
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose how you'd like to pay for this order.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {paymentMethods.map((option) => {
              // const isSelected = activePaymentMethodId === option.id;
              // const isBank = option.id === "bank";
              const isSelected = method === option.id;
              const isWallet = option.id === "wallet";
              const isCard = option.id === "card";
              const walletUnavailable = isWallet && momoWallets.length === 0;
              const cardUnavailable = isCard && cardAccounts.length === 0;
              const isDisabled = walletUnavailable || cardUnavailable;

              const cardCountLabel =
                cardAccounts.length === 1
                  ? "1 saved card ready to use."
                  : `${cardAccounts.length} saved cards ready to use.`;
              const walletBankLabel =
                momoWallets.length === 1
                  ? "1 linked wallet ready to use."
                  : `${momoWallets.length} linked wallets ready to use.`;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) {
                      openCustomerProfilePanel();
                      return;
                    }
                    setMethod(option.id);
                  }}
                  className={`flex h-full flex-col rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-orange-500 bg-orange-50 shadow-sm"
                      : "border-gray-200 hover:border-orange-300"
                  } ${isDisabled ? "opacity-60" : ""}`}
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {option.label}
                  </span>
                  <p className="mt-2 text-xs text-gray-500">
                    {option.description}
                  </p>
                  {isWallet ? (
                    <p className="mt-2 text-xs">
                      {walletUnavailable ? (
                        <span
                          className="cursor-pointer text-orange-500 underline underline-offset-2"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openCustomerProfilePanel();
                          }}
                        >
                          Link a MoMo wallet in your profile panel.
                        </span>
                      ) : (
                        <span className="text-emerald-600">
                          {walletBankLabel}
                        </span>
                      )}
                    </p>
                  ) : null}

                  {isCard ? (
                    <p className="mt-2 text-xs">
                      {cardUnavailable ? (
                        <span
                          className="cursor-pointer text-orange-500 underline underline-offset-2"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openCustomerProfilePanel();
                          }}
                        >
                          Link a card in your profile panel.
                        </span>
                      ) : (
                        <span className="text-emerald-600">{cardCountLabel}</span>
                      )}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {method === "card" && cardAccounts.length > 0 ? (
          <div className="mt-4 rounded-3xl border border-orange-200 bg-orange-50/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Select a saved card
                </p>
                <p className="text-xs text-gray-500">
                  Choose which card you want to charge for this order.
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-orange-500 hover:text-orange-600"
                onClick={openCustomerProfilePanel}
              >
                Manage cards
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {cardAccounts.map((card) => {
                const cardId = card.id;
                const isSelectedCard = selectedCardId
                  ? selectedCardId === cardId
                  : Boolean(card.isDefault);
                const expiry = getCardExpiry(card);
                return (
                  <label
                    key={cardId}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border bg-white px-4 py-3 transition ${
                      isSelectedCard
                        ? "border-orange-500 ring-2 ring-orange-100"
                        : "border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {getCardLabel(card)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {expiry ? `Expires ${expiry}` : "Expiration unavailable"}
                        {card.isDefault ? " • Default card" : ""}
                      </p>
                    </div>
                    <input
                      type="radio"
                      name="selected-card"
                      className="h-4 w-4 text-orange-500 focus:ring-orange-400"
                      checked={isSelectedCard}
                      onChange={() => setSelectedCardId(cardId)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="space-y-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Promo code
          </h2>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={discountCode}
              onChange={(event) => setDiscountCode(event.target.value)}
              placeholder="Enter discount code"
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <button
              onClick={handleApplyDiscount}
              className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Apply
            </button>
          </div>
          {appliedDiscountCode ? (
            <p className="mt-2 text-sm text-green-600">
              Applied code {appliedDiscountCode.code}.
            </p>
          ) : null}
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900">
            Order summary
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Review the charges before confirming.
          </p>

          <div className="mt-8 space-y-4 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">
                {currency}
                {subtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delivery fee</span>
              <span className="font-semibold">
                {currency}
                {shippingFee.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-green-600">
              <span>Discount</span>
              <span className="font-semibold">
                -{currency}
                {discount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between text-lg font-bold text-gray-900">
              <span>Total</span>
              <span>
                {currency}
                {total.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={
              isCartEmpty ||
              isPlacingOrder ||
              !isAuthenticated ||
              paymentSelectionInvalid
            }
            className={`mt-8 w-full rounded-full px-6 py-3 text-sm font-semibold text-white transition ${
              isCartEmpty ||
              isPlacingOrder ||
              !isAuthenticated ||
              paymentSelectionInvalid
                ? "cursor-not-allowed bg-gray-300"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {isPlacingOrder ? "Processing..." : "Proceed to Payment"}
          </button>
          {!isAuthenticated ? (
            <p className="mt-3 text-center text-xs text-amber-600">
              Please sign in to continue checkout.
            </p>
          ) : null}
          {paymentSelectionInvalid ? (
            <p className="mt-1 text-center text-xs text-amber-600">
              Link a MoMo wallet or card in your profile before completing payment.
            </p>
          ) : null}
          <p className="mt-3 text-center text-xs text-gray-400">
            By placing an order you agree to FoodFast's terms of use.
          </p>
        </div>
      </aside>
    </div>
  );
};

export default Checkout;
