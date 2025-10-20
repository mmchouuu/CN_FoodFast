import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  restaurantPlaceholderImage,
  dishPlaceholderImage,
} from "../utils/imageHelpers";

const StatusDot = ({ completed }) => (
  <span
    className={`inline-block h-3 w-3 rounded-full ${
      completed ? "bg-green-500" : "bg-gray-300"
    }`}
  />
);

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const {
    getOrderById,
    fetchOrderById,
    ordersLoading,
    currency,
  } = useAppContext();

  const [order, setOrder] = useState(() => getOrderById(orderId));
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) {
      navigate("/orders/history", { replace: true });
      return;
    }

    const cachedOrder = getOrderById(orderId);
    if (cachedOrder) {
      setOrder(cachedOrder);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchOrderById(orderId)
      .then((freshOrder) => {
        if (isMounted) {
          setOrder(freshOrder);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || "Unable to load order details.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [orderId, getOrderById, fetchOrderById, navigate]);

  const restaurantDisplay = useMemo(() => {
    if (!order) {
      return {
        name: "Restaurant",
        image: restaurantPlaceholderImage,
      };
    }
    const snapshot = order.restaurantSnapshot || {};
    const name = order.restaurantName || snapshot.name || "Restaurant";
    const image =
      order.restaurantImage ||
      snapshot.heroImage ||
      snapshot.image ||
      restaurantPlaceholderImage;
    return { name, image };
  }, [order]);

  if (loading || ordersLoading) {
    return (
      <div className="max-padd-container py-24 text-center">
        <p className="text-sm uppercase text-gray-400">Loading order...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-padd-container py-24 text-center">
        <p className="text-xl font-semibold text-gray-900">Order unavailable</p>
        <p className="mt-2 text-gray-500">{error}</p>
        <Link
          to="/orders/history"
          className="mt-6 inline-block rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-padd-container py-24 text-center">
        <p className="text-xl font-semibold text-gray-900">Order not found</p>
        <Link
          to="/orders/history"
          className="mt-6 inline-block rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const deliveryAddress = order.deliveryAddress || {};
  const deliveryAddressLine = [
    deliveryAddress.street,
    deliveryAddress.ward,
    deliveryAddress.district,
    deliveryAddress.city,
  ]
    .filter(Boolean)
    .join(", ");

  const timeline = Array.isArray(order.timeline) ? order.timeline : [];

  return (
    <div className="max-padd-container space-y-8 py-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <img
            src={restaurantDisplay.image}
            alt={restaurantDisplay.name}
            className="h-20 w-20 flex-shrink-0 rounded-3xl object-cover"
          />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Order #{order.id}
            </h1>
            <p className="text-sm text-gray-500">
              Placed at{" "}
              {new Date(order.placedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Restaurant:{" "}
              <Link
                to={`/restaurants/${order.restaurantId}`}
                className="font-semibold text-orange-500 hover:underline"
              >
                {restaurantDisplay.name}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
            Status: {order.status}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
            Payment: {order.paymentStatus || "pending"}
          </span>
          <Link
            to="/orders/history"
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-500"
          >
            Back to orders
          </Link>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Order timeline
            </h2>
            <div className="mt-6 space-y-4">
              {timeline.length ? (
                timeline.map((step) => (
                  <div key={step.id || step.label} className="flex items-start gap-4">
                    <StatusDot completed={Boolean(step.completed)} />
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
                  Timeline updates will appear here as the restaurant progresses
                  your order.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Order items</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-600">
              {order.items.map((item) => {
                const snapshot = item.productSnapshot || {};
                const dishTitle =
                  snapshot.title ||
                  snapshot.name ||
                  item.displayName ||
                  item.dishId;
                const dishImage =
                  snapshot.image ||
                  (Array.isArray(snapshot.images) ? snapshot.images[0] : null) ||
                  item.displayImage ||
                  dishPlaceholderImage;
                return (
                  <li
                    key={item.id || `${item.dishId}-${item.size}`}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={dishImage}
                        alt={dishTitle}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {item.quantity} x {dishTitle}
                        </p>
                        <p className="text-xs text-gray-500">
                          Size: {item.size || "Standard"}
                        </p>
                      </div>
                    </div>
                    <span className="text-right font-semibold text-gray-900">
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
              <div className="mt-3 flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>
                  {currency}
                  {order.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase text-gray-400">
              Payment
            </h3>
            <p className="mt-2 text-base font-semibold text-gray-900">
              Method: {order.paymentMethod}
            </p>
            <p className="text-sm text-gray-500">
              Status: {order.paymentStatus || "pending"}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Reference: {order.metadata?.payment?.reference || "N/A"}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase text-gray-400">
              Delivery address
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {deliveryAddressLine
                ? deliveryAddressLine
                : "Address not provided."}
            </p>
            {deliveryAddress.instructions ? (
              <p className="mt-2 text-xs text-gray-400">
                Note: {deliveryAddress.instructions}
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase text-gray-400">
              Need help?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              If something doesn&apos;t look right, get in touch with support
              and share your order reference.
            </p>
            <button className="mt-4 w-full rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500">
              Contact support
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default OrderDetails;
