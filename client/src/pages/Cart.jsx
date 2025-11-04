import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const Cart = () => {
  const {
    cartItems,
    cartItemDetails,
    products,
    updateQuantity,
    navigate,
    currency,
    getCartAmount,
    delivery_charges,
  } = useAppContext();

  const lineItems = useMemo(() => {
    const items = [];
    for (const itemId in cartItems) {
      const dish = products.find((product) => product._id === itemId);
      if (!dish) continue;
      const sizeMap = cartItems[itemId];
      for (const cartKey in sizeMap) {
        const quantity = sizeMap[cartKey];
        if (quantity <= 0) continue;
        const detailKey = `${itemId}:${cartKey}`;
        const detail = cartItemDetails[detailKey] || {};
        const [rawSizeLabel] = cartKey.split("::");
        const sizeLabel = detail.displaySize || rawSizeLabel || "Standard";
        const unitPrice =
          detail.unitPrice ??
          dish.price?.[sizeLabel] ??
          dish.basePrice ??
          dish.price?.Standard ??
          0;
        const taxAmount = detail.taxAmount ?? 0;
        const options = detail.options || [];
        items.push({
          id: detailKey,
          cartKey,
          dish,
          size: sizeLabel,
          quantity,
          unitPrice,
          subtotal: unitPrice * quantity,
          taxAmount,
          taxRate: detail.taxRate ?? 0,
          options,
        });
      }
    }
    return items;
  }, [cartItems, cartItemDetails, products]);

  const subtotal = getCartAmount();
  const shippingFee = subtotal === 0 ? 0 : delivery_charges;
  const estimatedTotal = subtotal + shippingFee;

  const handleIncrement = (dishId, cartKey) => {
    const current = cartItems[dishId]?.[cartKey] || 0;
    updateQuantity(dishId, cartKey, current + 1);
  };

  const handleDecrement = (dishId, cartKey) => {
    const current = cartItems[dishId]?.[cartKey] || 0;
    updateQuantity(dishId, cartKey, current - 1);
  };

  return (
    <div className="max-padd-container grid gap-8 py-24 lg:grid-cols-[2fr,1.1fr]">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Your cart</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review dishes, adjust quantities, and proceed to secure checkout.
          </p>
        </header>

        {lineItems.length ? (
          <div className="space-y-4">
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl">
                    <img
                      src={item.dish.images?.[0]}
                      alt={item.dish.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.dish.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold">Size:</span> {item.size} - {item.dish.category}
                    </p>

                    {item.options?.length ? (
                      <div className="mt-1 space-y-1 text-xs text-gray-500">
                        {item.options.map((group) => (
                          <p key={group.id || group.name}>
                            <span className="font-semibold text-gray-600">
                              {group.name}:
                            </span>{" "}
                            {(group.values || [])
                              .map((value) => {
                                const delta = value.priceDelta || 0;
                                return `${value.label}${delta
                                    ? ` (+${currency}${delta.toLocaleString()})`
                                    : ""
                                  }`;
                              })
                              .join(", ") || "Standard"}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <Link
                      to={`/restaurants/${item.dish.restaurantId}/dishes/${item.dish._id}`}
                      className="text-xs font-semibold text-orange-500 hover:underline"
                    >
                      View details
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-6">
                  <div className="flex items-center rounded-full border border-gray-200">
                    <button
                      onClick={() => handleDecrement(item.dish._id, item.cartKey)}
                      className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-orange-500"
                    >
                      -
                    </button>
                    <span className="px-4 text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleIncrement(item.dish._id, item.cartKey)}
                      className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-orange-500"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">
                      {currency}
                      {item.unitPrice.toLocaleString()} each (incl. VAT)
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {currency}
                      {item.subtotal.toLocaleString()}
                    </p>
                    {item.taxAmount ? (
                      <p className="text-xs text-gray-400">
                        VAT ({(item.taxRate * 100).toFixed(1)}%): {currency}
                        {(item.taxAmount * item.quantity).toLocaleString()}
                      </p>
                    ) : null}
                    <button
                      onClick={() => updateQuantity(item.dish._id, item.cartKey, 0)}
                      className="mt-1 text-xs font-semibold text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-10 text-center text-gray-500 shadow">
            Your cart is empty. Explore restaurants to add something tasty!
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-orange-50 px-6 py-4 text-sm text-orange-700">
          <span>
            Do you want to continue shopping?
          </span>
          <Link
            to="/restaurants"
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-orange-500 hover:bg-gray-100"
          >
            Continue browsing
          </Link>
        </div>
      </section>

      <aside className="space-y-6 rounded-3xl bg-white p-8 shadow-lg">
        <h2 className="text-xl font-semibold text-gray-900">Order summary</h2>
        <div className="space-y-3 text-sm text-gray-600">
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
        </div>
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between text-lg font-bold text-gray-900">
            <span>Estimated total</span>
            <span>
              {currency}
              {estimatedTotal.toLocaleString()}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate("/checkout")}
          disabled={!lineItems.length}
          className={`w-full rounded-full px-6 py-3 text-sm font-semibold text-white transition ${lineItems.length
              ? "bg-orange-500 hover:bg-orange-600"
              : "cursor-not-allowed bg-gray-300"
            }`}
        >
          Proceed to payment
        </button>
      </aside>
    </div>
  );
};

export default Cart;
