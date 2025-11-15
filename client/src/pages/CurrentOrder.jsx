import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  restaurantPlaceholderImage,
  dishPlaceholderImage,
} from "../utils/imageHelpers";
import { buildRestaurantLink } from "../utils/orderHelpers";
import resolvePaymentSummary from "../utils/paymentSummary";

const StatusDot = ({ completed }) => (
  <span
    className={`inline-block h-3 w-3 rounded-full ${completed ? "bg-green-500" : "bg-gray-300"
      }`}
  />
);

const ORDER_STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivering", label: "Delivering" },
  { key: "completed", label: "Completed" },
];

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);
const CONFIRMABLE_STATUSES = new Set(["ready", "delivering"]);

const normaliseStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const buildTrackingSteps = (status, placedAt) => {
  const normalisedStatus = normaliseStatus(status);
  const activeIndex = ORDER_STATUS_STEPS.findIndex(
    (step) => step.key === normalisedStatus,
  );
  const placedTime = placedAt
    ? new Date(placedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    : null;

  return ORDER_STATUS_STEPS.map((step, index) => {
    const completed =
      activeIndex >= 0 ? index <= activeIndex : index === 0;

    let timestamp = "Pending";
    if (index === 0) {
      timestamp = placedTime || "Pending";
    } else if (activeIndex === index) {
      timestamp = "In progress";
    } else if (index < activeIndex) {
      timestamp = "Completed";
    }

    return {
      id: `step-${step.key}`,
      label: step.label,
      completed,
      timestamp,
    };
  });
};

const parseAmount = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalised = value.replace(/[^0-9.-]+/g, "");
    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const resolveTotals = (order) => {
  const raw = order?.raw || {};
  const metadataPricing =
    order?.metadata && typeof order.metadata.pricing === "object"
      ? order.metadata.pricing
      : {};

  const subtotal = parseAmount(
    order?.subtotal ?? raw.items_subtotal ?? metadataPricing.items_subtotal,
  );
  const shippingFee = parseAmount(
    order?.shippingFee ?? raw.shipping_fee ?? metadataPricing.shipping_fee,
  );
  const vat = parseAmount(
    order?.taxTotal ?? raw.tax_total ?? metadataPricing.tax_total,
  );
  let discount = parseAmount(order?.discount ?? metadataPricing.discount);
  if (!discount) {
    const orderDiscount = parseAmount(raw.order_discount);
    const itemsDiscount = parseAmount(raw.items_discount);
    discount = orderDiscount + itemsDiscount;
  }
  const total = parseAmount(
    order?.totalAmount ?? raw.total_amount ?? metadataPricing.total_amount ?? metadataPricing.total,
  );

  return { subtotal, shippingFee, vat, discount, total };
};

const CurrentOrder = () => {
  const {
    activeOrders,
    pastOrders,
    getOrderById,
    getRestaurantById,
    getDishById,
    currency,
    cancelOrder,
    confirmOrderDelivered,
    refreshOrders,
  } = useAppContext();

  const location = useLocation();
  const requestedOrderId = location.state?.orderId || null;

  const [trackedOrderId, setTrackedOrderId] = useState(requestedOrderId || null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const pendingRefreshRef = useRef(false);

  useEffect(() => {
    if (requestedOrderId) {
      setTrackedOrderId(requestedOrderId);
    }
  }, [requestedOrderId]);

  const order = useMemo(() => {
    if (trackedOrderId) {
      const tracked = getOrderById(trackedOrderId);
      if (tracked) {
        return tracked;
      }
    }
    if (activeOrders.length) {
      return activeOrders[0];
    }
    if (pastOrders.length) {
      return pastOrders[0];
    }
    return null;
  }, [trackedOrderId, getOrderById, activeOrders, pastOrders]);

  useEffect(() => {
    if (!trackedOrderId || order) {
      pendingRefreshRef.current = false;
      return;
    }
    if (pendingRefreshRef.current || typeof refreshOrders !== "function") {
      return;
    }
    pendingRefreshRef.current = true;
    Promise.resolve(refreshOrders()).finally(() => {
      pendingRefreshRef.current = false;
    });
  }, [trackedOrderId, order, refreshOrders]);

  useEffect(() => {
    if (requestedOrderId && order) {
      window.history.replaceState(
        {},
        document.title,
        location.pathname + location.search,
      );
    }
  }, [requestedOrderId, order, location.pathname, location.search]);

  if (trackedOrderId && !order) {
    return (
      <div className="max-padd-container py-24 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Loading your new order…
        </h1>
        <p className="mt-2 text-gray-500">
          We just placed your order. Fetching the latest status now.
        </p>
      </div>
    );
  }

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
  const restaurantSnapshot =
    order.restaurantSnapshot || order.metadata?.restaurant_snapshot || {};
  const restaurantDisplayName =
    restaurant?.name ||
    restaurantSnapshot?.name ||
    "Restaurant";
  const restaurantDisplayImage =
    restaurant?.heroImage ||
    (Array.isArray(restaurant?.images) ? restaurant.images[0] : null) ||
    restaurantSnapshot?.heroImage ||
    restaurantSnapshot?.image ||
    restaurantPlaceholderImage;
  const deliveryAddress = order.deliveryAddress || {};
  const trackingSteps = useMemo(() => {
    if (Array.isArray(order.timeline) && order.timeline.length) {
      return order.timeline;
    }
    return buildTrackingSteps(order.status, order.placedAt);
  }, [order.timeline, order.status, order.placedAt]);
  const totals = useMemo(() => resolveTotals(order), [order]);
  const paymentSummary = useMemo(
    () => resolvePaymentSummary(order),
    [order],
  );
  const deliveryAddressLine = [
    deliveryAddress.street,
    deliveryAddress.ward,
    deliveryAddress.district,
    deliveryAddress.city,
  ]
    .filter(Boolean)
    .join(", ");
  const normalisedStatus = normaliseStatus(order.status);
  const canCancel =
    CANCELLABLE_STATUSES.has(normalisedStatus) &&
    (order.paymentStatus || "").toLowerCase() !== "paid";
  const canConfirm = CONFIRMABLE_STATUSES.has(normalisedStatus);

  const handleCancelOrder = async () => {
    if (!canCancel || !order) return;
    setIsCancelling(true);
    try {
      await cancelOrder(order.id);
    } catch (error) {
      console.error("Failed to cancel order", error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!canConfirm || !order) return;
    setIsConfirming(true);
    try {
      await confirmOrderDelivered(order.id);
    } catch (error) {
      console.error("Failed to confirm order", error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-padd-container grid gap-6 py-24 lg:grid-cols-[2fr,1.2fr]">
      <section className="space-y-6">
        <header className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <img
              src={restaurantDisplayImage}
              alt={restaurantDisplayName}
              className="h-20 w-20 flex-shrink-0 rounded-3xl object-cover"
            />
            <div className="flex-1">
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
                to={buildRestaurantLink(order)}
                className="mt-3 inline-block text-sm font-semibold text-orange-500 hover:underline"
              >
                {restaurantDisplayName}
              </Link>
              <Link
                to={`/orders/${order.id}`}
                className="mt-1 inline-block text-xs font-semibold text-gray-400 hover:text-orange-500"
              >
                View order details
              </Link>
            </div>
          </div>
          {(canConfirm || canCancel) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {canConfirm && (
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={isConfirming}
                  className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition ${isConfirming
                      ? "bg-gray-400"
                      : "bg-green-500 hover:bg-green-600"
                    }`}
                >
                  {isConfirming ? "Confirming..." : "Confirm order"}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${isCancelling
                      ? "border-gray-200 text-gray-400"
                      : "border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-500"
                    }`}
                >
                  {isCancelling ? "Cancelling..." : "Cancel order"}
                </button>
              )}
            </div>
          )}
        </header>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Live order tracking
          </h2>
          <div className="mt-6 space-y-4">
            {trackingSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-4">
                <StatusDot completed={step.completed} />
                <div>
                  <p
                    className={`text-sm font-semibold ${step.completed ? "text-gray-900" : "text-gray-500"
                      }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-400">{step.timestamp || "Pending"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Order items</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600">
            {order.items.map((item, index) => {
              const dish = getDishById(item.dishId);
              const snapshot = item.productSnapshot || {};
              const dishTitle =
                dish?.title ||
                snapshot.title ||
                snapshot.name ||
                item.displayName ||
                item.dishId;
              const dishImage =
                (Array.isArray(dish?.images) ? dish.images[0] : null) ||
                snapshot.image ||
                (Array.isArray(snapshot.images) ? snapshot.images[0] : null) ||
                item.displayImage ||
                dishPlaceholderImage;
              return (
                <li
                  key={`${item.dishId}-${index}`}
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
                      <p className="text-xs text-gray-500">Size: {item.size}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900 text-right">
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
                {totals.subtotal.toLocaleString()}

              </span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Shipping</span>
              <span>
                {currency}
                {totals.shippingFee.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>VAT</span>
              <span>
                {currency}
                {totals.vat.toLocaleString()}

              </span>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>
                  -{currency}
                  {totals.discount.toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>
          <p className="text-sm text-gray-500">
            Payment method:{" "}
            <span className="font-semibold text-gray-900">
              {paymentSummary.method}
            </span>
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Payment status:{" "}
            <span className="font-semibold text-gray-900">
              {paymentSummary.status}
            </span>
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-gray-400">
            Delivery address
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {deliveryAddressLine
              ? `We will deliver to ${deliveryAddressLine}.`
              : "The courier is heading to your selected address."}
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
