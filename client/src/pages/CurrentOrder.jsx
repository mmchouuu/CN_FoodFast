import React from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const StatusDot = ({ completed }) => (
  <span
    className={`inline-block h-3 w-3 rounded-full ${
      completed ? "bg-green-500" : "bg-gray-300"
    }`}
  />
);

const CurrentOrder = () => {
  const { activeOrders, getRestaurantById, getDishById, currency } =
    useAppContext();
  const order = activeOrders[0];

  if (!order) {
    return (
      <div className="max-padd-container py-24 text-center">
        <h1 className="text-3xl font-bold text-gray-900">No active order</h1>
        <p className="mt-2 text-gray-500">
          When you place a new order you will be able to track it here in real
          time.
        </p>
        <Link
          to="/restaurants"
          className="mt-6 inline-block rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white"
        >
          Browse restaurants
        </Link>
      </div>
    );
  }

  const restaurant = getRestaurantById(order.restaurantId);
  const courier = order.courier || {};
  const deliveryAddress = order.deliveryAddress || {};
  const hasTimeline = Array.isArray(order.timeline) && order.timeline.length > 0;
  const deliveryAddressLine = [
    deliveryAddress.street,
    deliveryAddress.ward,
    deliveryAddress.district,
    deliveryAddress.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-padd-container grid gap-6 py-24 lg:grid-cols-[2fr,1.2fr]">
      <section className="space-y-6">
        <header className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm uppercase text-gray-400">Current order</p>
          <h1 className="text-3xl font-bold text-gray-900">
            Order #{order.id}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Placed at{" "}
            {new Date(order.placedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            - Expected in {order.etaMinutes} minutes
          </p>
          <Link
            to={`/restaurants/${order.restaurantId}`}
            className="mt-3 inline-block text-sm font-semibold text-orange-500 hover:underline"
          >
            {restaurant?.name || "View restaurant"}
          </Link>
        </header>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Live order tracking
          </h2>
          <div className="mt-6 space-y-4">
            {hasTimeline ? (
              order.timeline.map((step) => (
                <div key={step.id} className="flex items-start gap-4">
                  <StatusDot completed={step.completed} />
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        step.completed ? "text-gray-900" : "text-gray-500"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-400">
                      {step.timestamp || "Pending"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                Tracking updates will appear here as soon as the restaurant progresses your order.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Order items</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600">
            {order.items.map((item, index) => {
              const dish = getDishById(item.dishId);
              return (
                <li
                  key={`${item.dishId}-${index}`}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {item.quantity} x {dish?.title || item.dishId}
                    </p>
                    <p className="text-xs text-gray-500">Size: {item.size}</p>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {currency}
                    {item.price.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">
                {currency}
                {order.subtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Shipping</span>
              <span>
                {currency}
                {order.shippingFee.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>
                -{currency}
                {order.discount.toLocaleString()}
              </span>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Payment status:{" "}
            <span className="font-semibold text-gray-900">
              {order.paymentStatus || "pending"}
            </span>
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase text-gray-400">
              Driver
            </h3>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {courier.name || "Assigning driver..."}
            </p>
            <p className="text-sm text-gray-500">
              {courier.phone || "We'll share contact details once available."}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {courier.vehicle || "Vehicle information pending."}
            </p>
            <div className="mt-4 flex gap-3">
              <button className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-500">
                Message
              </button>
              <button className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600">
                Call driver
              </button>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase text-gray-400">
              Delivery address
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {deliveryAddressLine
                ? `We will deliver to ${deliveryAddressLine}.`
                : "The driver is heading to your selected address."}
            </p>
            {deliveryAddress.instructions ? (
              <p className="mt-2 text-xs text-gray-400">
                Note: {deliveryAddress.instructions}
              </p>
            ) : null}
            <p className="mt-4 text-xs uppercase text-orange-500">
              Real time map preview
            </p>
            <div className="mt-2 h-40 w-full rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 text-center text-xs font-semibold uppercase text-gray-400">
              <div className="flex h-full items-center justify-center">
                Map preview placeholder
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="rounded-3xl bg-white p-8 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900">
          Need help with this order?
        </h2>
        <div className="mt-4 space-y-4 text-sm text-gray-600">
          <button className="w-full rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500">
            Report a problem
          </button>
          <button className="w-full rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500">
            Update delivery instructions
          </button>
          <button className="w-full rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500">
            Contact support
          </button>
        </div>
        <p className="mt-6 text-xs text-gray-400">
          If you cancel now, you may be charged a preparation fee.
        </p>
      </aside>
    </div>
  );
};

export default CurrentOrder;
