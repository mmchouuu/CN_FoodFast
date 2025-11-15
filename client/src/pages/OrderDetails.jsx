import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  restaurantPlaceholderImage,
  dishPlaceholderImage,
} from "../utils/imageHelpers";
import { buildRestaurantLink } from "../utils/orderHelpers";
import resolvePaymentSummary from "../utils/paymentSummary";

const StatusDot = ({ completed }) => (
  <span
    className={`inline-block h-3 w-3 rounded-full ${
      completed ? "bg-green-500" : "bg-gray-300"
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

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const {
    getOrderById,
    fetchOrderById,
    ordersLoading,
    currency,
    cancelOrder,
    confirmOrderDelivered,
  } = useAppContext();

  const [order, setOrder] = useState(() => getOrderById(orderId));
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({
    cancel: false,
    confirm: false,
  });

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

  const timeline = useMemo(() => {
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
  const normalisedStatus = normaliseStatus(order?.status);
  const canCancel =
    Boolean(order) &&
    CANCELLABLE_STATUSES.has(normalisedStatus) &&
    (order.paymentStatus || "").toLowerCase() !== "paid";
  const canConfirm = Boolean(order) && CONFIRMABLE_STATUSES.has(normalisedStatus);

  const handleCancelOrder = async () => {
    if (!order || !canCancel) return;
    setActionLoading((prev) => ({ ...prev, cancel: true }));
    try {
      const updated = await cancelOrder(order.id);
      if (updated) {
        setOrder(updated);
      }
    } catch (err) {
      console.error("Failed to cancel order", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, cancel: false }));
    }
  };

  const handleConfirmOrder = async () => {
    if (!order || !canConfirm) return;
    setActionLoading((prev) => ({ ...prev, confirm: true }));
    try {
      const updated = await confirmOrderDelivered(order.id);
      if (updated) {
        setOrder(updated);
      }
    } catch (err) {
      console.error("Failed to confirm order", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, confirm: false }));
    }
  };

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
                to={buildRestaurantLink(order)}
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
            Payment: {paymentSummary.status}
          </span>
          {canConfirm && (
            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={actionLoading.confirm}
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${
                actionLoading.confirm
                  ? "bg-gray-400"
                  : "bg-green-500 hover:bg-green-600"
              }`}
            >
              {actionLoading.confirm ? "Confirming..." : "Received order"}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={actionLoading.cancel}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                actionLoading.cancel
                  ? "border-gray-200 text-gray-400"
                  : "border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-500"
              }`}
            >
              {actionLoading.cancel ? "Cancelling..." : "Cancel order"}
            </button>
          )}
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
              {timeline.map((step) => (
                <div key={step.id} className="flex items-start gap-4">
                  <StatusDot completed={Boolean(step.completed)} />
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        step.completed ? "text-gray-900" : "text-gray-500"
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
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>
                  -{currency}
                  {totals.discount.toLocaleString()}
                </span>
              </div>
              <div className="mt-3 flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>
                  {currency}
                  {totals.total.toLocaleString()}
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
              Method: {paymentSummary.method}
            </p>
            <p className="text-sm text-gray-500">
              Status: {paymentSummary.status}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Reference: {paymentSummary.reference}
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
