import React, { useState } from "react";
import { useAppContext } from "../context/AppContext";

const CartTotal = () => {
  const {
    currency,
    delivery_charges,
    getCartCount,
    getCartAmount,
    method,
    setMethod,
    addresses,
    selectedAddressId,
    setSelectedAddressId,
  } = useAppContext();

  const [showAddresses, setShowAddresses] = useState(false);
  const subtotal = getCartAmount();
  const shippingFee = subtotal === 0 ? 0 : delivery_charges;
  const tax = Math.round(subtotal * 0.02);
  const total = subtotal + shippingFee + tax;

  const selectedAddress = addresses.find(
    (address) => address.id === selectedAddressId
  );

  return (
    <div className="space-y-5 rounded-3xl bg-white p-6 shadow-sm">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Order details</h3>
        <span className="text-sm font-semibold text-orange-500">
          {getCartCount()} items
        </span>
      </header>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-600">Deliver to</h4>
        <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
          {selectedAddress ? (
            <>
              <p className="font-semibold text-gray-900">
                {selectedAddress.recipient}
              </p>
              <p>{selectedAddress.phone}</p>
              <p>
                {selectedAddress.street}, {selectedAddress.ward},{" "}
                {selectedAddress.district}, {selectedAddress.city}
              </p>
            </>
          ) : (
            <p>No address selected.</p>
          )}
          <button
            onClick={() => setShowAddresses((prev) => !prev)}
            className="mt-3 text-xs font-semibold text-orange-500 hover:underline"
          >
            {showAddresses ? "Hide addresses" : "Change address"}
          </button>
          {showAddresses ? (
            <div className="mt-3 space-y-2">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  onClick={() => {
                    setSelectedAddressId(address.id);
                    setShowAddresses(false);
                  }}
                  className={`w-full rounded-2xl border p-3 text-left text-xs transition ${
                    selectedAddressId === address.id
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-orange-300"
                  }`}
                >
                  <div className="font-semibold text-gray-900">
                    {address.label}
                  </div>
                  <div className="text-gray-500">{address.street}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-600">Payment method</h4>
        <div className="flex gap-2">
          {["COD", "wallet", "card"].map((option) => (
            <button
              key={option}
              onClick={() => setMethod(option)}
              className={`flex-1 rounded-2xl border px-4 py-2 text-xs font-semibold uppercase transition ${
                method === option
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span className="font-semibold">
            {currency}
            {subtotal.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Shipping fee</span>
          <span className="font-semibold">
            {currency}
            {shippingFee.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Tax (2%)</span>
          <span className="font-semibold">
            {currency}
            {tax.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-lg font-bold text-gray-900">
          <span>Total</span>
          <span>
            {currency}
            {total.toLocaleString()}
          </span>
        </div>
      </section>

      <button className="w-full rounded-full bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
        Continue to checkout
      </button>
    </div>
  );
};

export default CartTotal;
