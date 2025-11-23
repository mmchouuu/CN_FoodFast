import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAppContext } from "../context/AppContext";
import {
  restaurantPlaceholderImage,
  dishPlaceholderImage,
} from "../utils/imageHelpers";
import { buildRestaurantLink } from "../utils/orderHelpers";
import resolvePaymentSummary from "../utils/paymentSummary";

const StatusDot = ({ completed, variant = "default" }) => {
  const colorClass =
    variant === "cancelled"
      ? "bg-red-500"
      : completed
        ? "bg-green-500"
        : "bg-gray-300";
  return <span className={`inline-block h-3 w-3 rounded-full ${colorClass}`} />;
};

const ORDER_STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivering", label: "Delivering" },
  { key: "completed", label: "Completed" },
];

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed", "preparing"]);

const CONFIRMABLE_STATUSES = new Set(["ready", "delivering"]);
const ORDER_HISTORY_STATUSES = new Set(["delivered", "completed", "cancelled"]);

const SUGGESTED_CANCEL_REASONS = [
  "Changed my mind, want to cancel this order",
  "Order confirmation time is too long",
  "Ordered wrong item/address, want to reorder",
];

const SOCKET_GATEWAY_URL = import.meta.env.VITE_SOCKET_GATEWAY_URL || "http://localhost:4000";
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || "";
const CUSTOM_MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || "";
const MAP_STYLE =
  CUSTOM_MAP_STYLE ||
  (MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${MAPTILER_KEY}`
    : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json");

const toLngLat = (point) => {
  if (!point || typeof point !== "object") return null;
  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.lon ?? point.long ?? point.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat];
};

const normaliseStatus = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const key = value.trim().toLowerCase();
  if (!key) {
    return "";
  }
  return key.startsWith("cancel") ? "cancelled" : key;
};

const buildTrackingSteps = (status, placedAt, updatedAt) => {
  const normalisedStatus = normaliseStatus(status);
  const sequence =
    normalisedStatus === "cancelled"
      ? ORDER_STATUS_STEPS.filter((step) =>
        ["pending", "confirmed", "cancelled"].includes(step.key),
      )
      : ORDER_STATUS_STEPS.filter((step) => step.key !== "cancelled");

  const activeIndex = sequence.findIndex(
    (step) => step.key === normalisedStatus,
  );
  const placedTime = placedAt
    ? new Date(placedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    : null;
  const cancelledTime =
    updatedAt && normalisedStatus === "cancelled"
      ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

  return sequence.map((step, index) => {
    const completed =
      activeIndex >= 0 ? index <= activeIndex : index === 0;

    let timestamp = "Pending";
    if (index === 0) {
      timestamp = placedTime || "Pending";
    } else if (activeIndex === index) {
      timestamp = step.key === "cancelled" ? cancelledTime || "Cancelled" : "In progress";
    } else if (index < activeIndex) {
      timestamp = "Completed";
    }

    return {
      id: `step-${step.key}`,
      label: step.label,
      status: step.key,
      completed,
      variant: step.key === "cancelled" ? "cancelled" : "default",
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
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const droneMarkerRef = useRef(null);
  const hubMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const routeSourceId = useRef(`route-${Math.random().toString(36).slice(2)}`);
  const [telemetry, setTelemetry] = useState(null);
  const [socketState, setSocketState] = useState("connecting");
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
    return activeOrders.length ? activeOrders[0] : null;
  }, [trackedOrderId, getOrderById, activeOrders]);

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

  const normalisedStatus = normaliseStatus(order?.status);
  const isHistorical = Boolean(order && ORDER_HISTORY_STATUSES.has(normalisedStatus));
  const deliveryId =
    order?.deliveryId ||
    order?.metadata?.delivery_id ||
    order?.metadata?.delivery?.id ||
    null;
  const deliveryPosition =
    telemetry?.position ||
    order?.deliveryCurrentPosition ||
    order?.metadata?.delivery?.current_position ||
    null;
  const deliveryRoute = order?.deliveryRoute || order?.metadata?.delivery?.route || null;
  const deliveryDrone = telemetry?.drone || order?.deliveryDrone || null;
  const deliveryStatus =
    telemetry?.status ||
    order?.deliveryStatus ||
    order?.metadata?.delivery_status ||
    order?.metadata?.delivery?.delivery_status ||
    null;

  useEffect(() => {
    if (isHistorical && trackedOrderId) {
      setTrackedOrderId(null);
    }
  }, [isHistorical, trackedOrderId]);

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

  if (!order || isHistorical) {
    const completedCode = order?.id ? `Order #${order.id}` : "Your latest order";
    const cta =
      order ?
        {
          label: "View order history",
          href: "/orders/history",
        } :
        {
          label: "Browse restaurants",
          href: "/restaurants",
        };
    return (
      <div className="max-padd-container py-24 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {order ? "You're all caught up!" : "No active order"}
        </h1>
        <p className="mt-2 text-gray-500">
          {order
            ? `${completedCode} is ${normalisedStatus}. You can find it in your order history.`
            : "When you place a new order you will be able to track it here in real time."}
        </p>
        <Link
          to={cta.href}
          className="mt-6 inline-block rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white"
        >
          {cta.label}
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
  const deliveryDetails = order?.delivery || (order?.metadata?.delivery ?? null);
  const droneDetails =
    deliveryDrone ||
    telemetry?.drone ||
    deliveryDetails?.drone_snapshot ||
    deliveryDetails?.drone ||
    deliveryDetails?.droneInfo ||
    null;
  const droneCode = droneDetails?.code || droneDetails?.identifier || droneDetails?.name || null;
  const droneModel = droneDetails?.model || droneDetails?.drone_model || null;
  const rawBattery =
    telemetry?.batteryLevel ??
    droneDetails?.battery_level ??
    droneDetails?.batteryLevel ??
    null;
  const droneBatteryLevel =
    typeof rawBattery === "number" ? Math.max(0, Math.min(100, rawBattery)) : null;
  const droneStatus =
    deliveryStatus ||
    deliveryDetails?.delivery_status ||
    droneDetails?.status ||
    (normalisedStatus === "delivering" ? "flying" : null);
  const droneDistanceMeters =
    typeof deliveryDetails?.distance_meters === "number"
      ? deliveryDetails.distance_meters
      : null;
  const droneEtaSeconds =
    typeof deliveryDetails?.estimated_time_sec === "number"
      ? deliveryDetails.estimated_time_sec
      : null;
  const droneProgress =
    typeof deliveryDetails?.progress_percent === "number"
      ? Math.max(0, Math.min(100, deliveryDetails.progress_percent))
      : null;
  const lastKnownPosition =
    deliveryPosition ||
    deliveryDetails?.current_position ||
    deliveryDetails?.last_known_position ||
    droneDetails?.last_known_position ||
    null;
  const friendlyDroneStatus = droneStatus
    ? droneStatus
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
    : null;
  const droneDistanceLabel =
    typeof droneDistanceMeters === "number"
      ? droneDistanceMeters >= 1000
        ? `${(droneDistanceMeters / 1000).toFixed(1)} km`
        : `${Math.round(droneDistanceMeters)} m`
      : null;
  const droneEtaLabel =
    typeof droneEtaSeconds === "number"
      ? `${Math.max(1, Math.round(droneEtaSeconds / 60))} min`
      : null;
  const dronePositionLabel =
    lastKnownPosition && typeof lastKnownPosition === "object"
      ? lastKnownPosition.formatted ||
      lastKnownPosition.address ||
      (Array.isArray(lastKnownPosition.coordinates)
        ? `${lastKnownPosition.coordinates[0]}, ${lastKnownPosition.coordinates[1]}`
        : null)
      : null;
  const customerCoord = toLngLat(order?.deliverySnapshot?.location || order?.deliverySnapshot);
  const hubCoord = toLngLat(order?.restaurantSnapshot?.location || order?.restaurantSnapshot);
  // Force show map for preview/design even when delivery has not been assigned yet.
  const showDroneTracking = true;

  useEffect(() => {
    if (!showDroneTracking || mapRef.current || !mapContainerRef.current) return;
    const fallbackCenter = toLngLat(deliveryPosition) || customerCoord || hubCoord || [106.7, 10.78];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: fallbackCenter,
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    return () => {
      map.remove();
      mapRef.current = null;
      droneMarkerRef.current = null;
      hubMarkerRef.current = null;
      customerMarkerRef.current = null;
    };
  }, [showDroneTracking, deliveryPosition, customerCoord, hubCoord]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showDroneTracking) return;

    const routeCoords = Array.isArray(deliveryRoute?.waypoints)
      ? deliveryRoute.waypoints.map(toLngLat).filter(Boolean)
      : [];

    if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }
    if (hubMarkerRef.current) {
      hubMarkerRef.current.remove();
      hubMarkerRef.current = null;
    }

    if (customerCoord) {
      customerMarkerRef.current = new maplibregl.Marker({ color: "#f97316" })
        .setLngLat(customerCoord)
        .addTo(map);
    }
    if (hubCoord) {
      hubMarkerRef.current = new maplibregl.Marker({ color: "#4f46e5" })
        .setLngLat(hubCoord)
        .addTo(map);
    }

    if (map.getSource(routeSourceId.current)) {
      map.removeLayer(`${routeSourceId.current}-line`);
      map.removeSource(routeSourceId.current);
    }
    if (routeCoords.length >= 2) {
      map.addSource(routeSourceId.current, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: routeCoords },
        },
      });
      map.addLayer({
        id: `${routeSourceId.current}-line`,
        type: "line",
        source: routeSourceId.current,
        paint: { "line-color": "#10b981", "line-width": 4 },
      });
    }
  }, [deliveryRoute, order?.deliverySnapshot, order?.restaurantSnapshot, showDroneTracking, customerCoord, hubCoord]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showDroneTracking) return;
    const coord = toLngLat(deliveryPosition);
    if (!coord) return;
    if (!droneMarkerRef.current) {
      droneMarkerRef.current = new maplibregl.Marker({ color: "#0ea5e9" })
        .setLngLat(coord)
        .addTo(map);
    } else {
      droneMarkerRef.current.setLngLat(coord);
    }
  }, [deliveryPosition, showDroneTracking]);

  useEffect(() => {
    if (!deliveryId || !showDroneTracking) return undefined;
    const socket = io(SOCKET_GATEWAY_URL, {
      transports: ["websocket"],
      query: { role: "customer", deliveryId },
    });
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("drone:update", (payload) => {
      if (!payload || payload.deliveryId !== deliveryId) return;
      setTelemetry({
        position: payload.position || null,
        status: payload.status || null,
        batteryLevel: payload.batteryLevel ?? null,
        speed: payload.speed ?? null,
        heading: payload.heading ?? null,
        recordedAt: payload.recordedAt || new Date().toISOString(),
        drone: {
          id: payload.droneId,
          code: payload.code,
          hubId: payload.hubId,
          hubName: payload.hubName,
        },
      });
    });
    return () => {
      socket.disconnect();
      setSocketState("disconnected");
    };
  }, [deliveryId, showDroneTracking]);

  const fallbackEtaLabel =
    typeof order?.etaMinutes === "number"
      ? `${order.etaMinutes} min`
      : "Updating";
  const trackingSteps = useMemo(() => {
    const normalised = normaliseStatus(order.status);
    const fallbackSteps = buildTrackingSteps(order.status, order.placedAt, order.updatedAt);
    let steps = [];
    if (Array.isArray(order.timeline) && order.timeline.length) {
      steps = order.timeline;
    } else {
      steps = fallbackSteps;
    }

    if (normalised === "cancelled") {
      const cancelIndex = steps.findIndex(
        (step) => normaliseStatus(step.status || step.label) === "cancelled",
      );
      const sliced =
        cancelIndex >= 0 ? steps.slice(0, cancelIndex + 1) : fallbackSteps;
      return sliced.map((step) => ({
        ...step,
        completed: true,
        variant:
          normaliseStatus(step.status || step.label) === "cancelled"
            ? "cancelled"
            : "default",
      }));
    }

    let mapped = steps.map((step) => ({
      ...step,
      variant: step.variant || "default",
    }));

    // Insert a "Request Cancel" row if customer has requested cancellation
    const cancelReqRaw = order?.metadata?.cancel_request || order?.metadata?.order_refund_request || null;
    const rawStatus = cancelReqRaw && typeof cancelReqRaw.status === 'string' ? cancelReqRaw.status.toLowerCase() : '';
    const pendingCancel = rawStatus === 'pending' || rawStatus === 'requested';
    if (pendingCancel) {
      const reqAt = cancelReqRaw?.created_at || cancelReqRaw?.at || cancelReqRaw?.requested_at;
      const time = reqAt
        ? new Date(reqAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Pending";
      const preparingIndex = mapped.findIndex(
        (s) => normaliseStatus(s.status || s.label) === "preparing",
      );
      const insertAt = preparingIndex >= 0 ? preparingIndex + 1 : mapped.length;
      mapped = [
        ...mapped.slice(0, insertAt),
        {
          id: "status-request-cancel",
          label: "Request Cancel",
          status: "request-cancel",
          completed: false,
          timestamp: time,
          variant: "cancelled",
        },
        ...mapped.slice(insertAt),
      ];
    }

    return mapped;
  }, [order.timeline, order.status, order.placedAt, order.updatedAt, order?.metadata]);
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

  const cancelRequest = order.metadata?.cancel_request || order.metadata?.order_refund_request || null;
  const cancelRequestStatus =
    cancelRequest && typeof cancelRequest.status === "string"
      ? (cancelRequest.status.toLowerCase() === 'requested' ? 'pending' : cancelRequest.status.toLowerCase())
      : "";
  const isCancelRequestPending = cancelRequestStatus === "pending";
  const isCancelRequestRejected = cancelRequestStatus === "rejected";
  const canCancel =
    CANCELLABLE_STATUSES.has(normalisedStatus) &&
    !isCancelRequestPending &&
    !isCancelRequestRejected;
  const canConfirm = CONFIRMABLE_STATUSES.has(normalisedStatus);


  useEffect(() => {
    if (!canCancel && showCancelDialog) {
      setShowCancelDialog(false);
    }
  }, [canCancel, showCancelDialog]);

  const openCancelDialog = () => {
    if (!canCancel || !order) return;
    setCancelReason("");
    setCancelError("");
    setShowCancelDialog(true);
  };

  const handleCancelOrder = async () => {
    if (!canCancel || !order) return;
    if (!cancelReason.trim()) {
      setCancelError("Please enter reason for cancellation.");
      return;
    }
    setIsCancelling(true);
    setCancelError("");
    try {
      await cancelOrder(order.id, { reason: cancelReason.trim() });
      setShowCancelDialog(false);
      if (typeof refreshOrders === "function") {
        refreshOrders().catch(() => {});
      }
    } catch (error) {
      console.error("Failed to cancel order", error);
      setCancelError(
        error?.message || "The order cannot be cancelled. Please try again.",
      );
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
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-orange-500">
                  Cancel order
                </p>
                <h3 className="text-lg font-bold text-gray-900">
                  Confirm cancellation of this order?
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  The order is in uncooked status. Upon cancellation, the money will be refunded 
                  100% to your payment method.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isCancelling && setShowCancelDialog(false)}
                className="text-gray-400 transition hover:text-gray-600"
                aria-label="Close"
              >
                x
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Select or enter a reason</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_CANCEL_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReason(reason)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-50"
                placeholder="Enter reason for cancellation..."
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                disabled={isCancelling}
              />
              {cancelError ? (
                <p className="text-sm text-red-500">{cancelError}</p>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                disabled={isCancelling}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition ${isCancelling
                    ? "bg-gray-400"
                    : "bg-red-500 hover:bg-red-600"
                  }`}
              >
                {isCancelling ? "Cancelling..." : "Cancel order"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onClick={openCancelDialog}
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

        {cancelRequestStatus === "pending" ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-sm font-semibold text-amber-800">
              Cancellation request sent, please wait for restaurant confirmation.
            </p>
            <p className="text-sm text-amber-700">
              We will notify you as soon as your request is processed.
            </p>
          </div>
        ) : null}

        {cancelRequestStatus === "rejected" ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="text-sm font-semibold text-red-700">
              Notice: “Cancellation request denied, application is still being prepared”.
            </p>
          </div>
        ) : null}

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Live order tracking
          </h2>
          <div className="mt-6 space-y-4">
            {trackingSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-4">
                <StatusDot completed={step.completed} variant={step.variant} />
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
          {showDroneTracking ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-orange-500">
                  Real time map preview
                </p>
                <div
                  ref={mapContainerRef}
                  className="mt-2 h-64 w-full overflow-hidden rounded-2xl border border-gray-100"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Live updates: {socketState === "connected" ? "Connected" : "Reconnecting…"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Assigned drone
                </p>
                <h4 className="mt-2 text-lg font-semibold text-gray-900">
                  {droneCode || "Awaiting dispatch"}
                </h4>
                <p className="text-sm text-gray-500">
                  {droneModel || "Drone details will appear once dispatched."}
                </p>
                <dl className="mt-4 space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="font-semibold">
                      {friendlyDroneStatus || "Updating"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Battery</span>
                    <span className="font-semibold">
                      {droneBatteryLevel !== null ? `${droneBatteryLevel}%` : "Updating"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ETA</span>
                    <span className="font-semibold">
                      {droneEtaLabel || `${order.etaMinutes} min`}
                    </span>
                  </div>
                  {droneDistanceLabel ? (
                    <div className="flex justify-between">
                      <span>Distance</span>
                      <span className="font-semibold">{droneDistanceLabel}</span>
                    </div>
                  ) : null}
                  {dronePositionLabel ? (
                    <div className="flex justify-between">
                      <span>Last seen</span>
                      <span className="text-right font-semibold">
                        {dronePositionLabel}
                      </span>
                    </div>
                  ) : null}
                </dl>
                {droneProgress !== null ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Flight progress</span>
                      <span>{droneProgress}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${droneProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                <button className="mt-4 w-full rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:border-emerald-300 hover:text-emerald-600">
                  View flight logs
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-400">
              Drone tracking will appear once your order is out for delivery.
            </p>
          )}
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
