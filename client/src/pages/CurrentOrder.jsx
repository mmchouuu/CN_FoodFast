import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import mapConfig from "../config/mapConfig";
import api from "../services/api";

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

const SOCKET_GATEWAY_URL =
  import.meta.env.VITE_SOCKET_GATEWAY_URL || "http://localhost:4000";
const CUSTOM_MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || "";
const MAP_STYLE = CUSTOM_MAP_STYLE || mapConfig.styleUrl;

const formatEta = (seconds) => {
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return "--";
  const mins = Math.max(1, Math.round(parsed / 60));
  return `${mins} min`;
};

const deriveStageFromStatus = (status) => {
  if (!status || typeof status !== "string") return null;
  const normalized = status.toLowerCase();
  if (normalized === "arriving") return "arriving";
  if (normalized === "completed") return "delivered";
  if (normalized === "returning") return "returning";
  if (normalized === "idle" || normalized === "charging" || normalized === "landed") {
    return "landed";
  }
  if (normalized === "to_customer" || normalized === "flying" || normalized === "delivering") {
    return "to_customer";
  }
  if (normalized === "to_restaurant" || normalized === "assigned" || normalized === "pending") {
    return "to_restaurant";
  }
  if (normalized === "delivered") return "delivered";
  return "to_restaurant";
};

const formatStageMessage = (stage, fallbackStatus) => {
  if (!stage && !fallbackStatus) return "Drone assigned";
  const normalized = (stage || fallbackStatus || "").toLowerCase();
  switch (normalized) {
    case "to_restaurant":
      return "Going to restaurant";
    case "arriving":
      return "Picking up your meal";
    case "to_customer":
    case "flying":
    case "delivering":
      return "Delivering to you";
    case "delivered":
      return "Delivery completed";
    case "returning":
      return "Returning to hub";
    case "landed":
      return "Drone is ready for next mission";
    default:
      return (fallbackStatus || normalized || "In transit")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

const stageBadgeClass = (stage) => {
  const normalized = (stage || "").toLowerCase();
  if (normalized === "arriving") return "bg-amber-100 text-amber-700";
  if (normalized === "to_customer" || normalized === "flying" || normalized === "delivering") {
    return "bg-orange-100 text-orange-700";
  }
  if (normalized === "delivered") return "bg-emerald-100 text-emerald-700";
  if (normalized === "returning" || normalized === "landed") return "bg-indigo-100 text-indigo-700";
  if (normalized === "to_restaurant") return "bg-sky-100 text-sky-700";
  return "bg-neutral-100 text-neutral-600";
};

const toLngLat = (value) => {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const lng = Number(value[0]);
    const lat = Number(value[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lng, lat];
    }
  }
  if (typeof value === "object") {
    if (value.location) {
      return toLngLat(value.location);
    }
    const lat = Number(
      value.lat ??
        value.latitude ??
        value[1],
    );
    const lng = Number(
      value.lng ??
        value.lon ??
        value.longitude ??
        value[0],
    );
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lng, lat];
    }
  }
  if (typeof value === "string") {
    const parts = value.split(",").map((part) => Number(part.trim()));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return [parts[0], parts[1]];
    }
  }
  return null;
};

const decodePolyline = (str) => {
  if (!str || typeof str !== "string") return [];
  let index = 0;
  const len = str.length;
  const coordinates = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng * 1e-5, lat * 1e-5]);
  }
  return coordinates;
};

const buildCustomerMapData = ({
  hubCoord,
  branchCoord,
  customerCoord,
  droneCoord,
  stage,
  route,
}) => {
  const features = [];
  const points = [];
  const coords = [];
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  const coordsFromLeg = (label) => {
    const leg = legs.find((entry) => entry?.label === label);
    if (!leg) return [];
    if (Array.isArray(leg.geometry?.coordinates)) {
      return leg.geometry.coordinates
        .map((pair) => {
          if (Array.isArray(pair) && pair.length >= 2) return pair;
          if (typeof pair === "object" && pair !== null) {
            const lat = Number(pair.lat ?? pair.latitude);
            const lng = Number(pair.lng ?? pair.lon ?? pair.longitude);
            return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
          }
          return null;
        })
        .filter(Boolean);
    }
    if (typeof leg.geometry === "string") {
      return decodePolyline(leg.geometry);
    }
    if (typeof leg.polyline === "string") {
      return decodePolyline(leg.polyline);
    }
    return [];
  };

  const hubToBranchPath = coordsFromLeg("hub_to_branch");
  const branchToCustomerPath = coordsFromLeg("branch_to_customer");
  const pushLine = (segment, coordinates) => {
    const valid = coordinates.filter(Boolean);
    if (valid.length < 2) return;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: valid },
      properties: { segment },
    });
    valid.forEach((coord) => coords.push(coord));
  };
  const pushPoint = (coord, pointType, title) => {
    if (!coord) return;
    points.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { pointType, title },
    });
    coords.push(coord);
  };

  if (branchToCustomerPath.length >= 2) {
    pushLine("delivery", branchToCustomerPath);
  } else if (branchCoord && customerCoord) {
    pushLine("delivery", [branchCoord, customerCoord]);
  }
  const normalizedStage = (stage || "").toLowerCase();
  if (hubToBranchPath.length >= 2) {
    pushLine("approach", hubToBranchPath);
  } else if (hubCoord && branchCoord) {
    pushLine("approach", [hubCoord, branchCoord]);
  }
  if (normalizedStage === "to_restaurant" || normalizedStage === "arriving") {
    if (hubToBranchPath.length >= 2) {
      pushLine("active", hubToBranchPath);
    }
  } else if (normalizedStage === "to_customer" || normalizedStage === "delivered") {
    if (branchToCustomerPath.length >= 2) {
      pushLine("active", branchToCustomerPath);
    }
  } else if (normalizedStage === "returning") {
    const returnPath =
      hubToBranchPath.length >= 2
        ? [...hubToBranchPath].reverse()
        : hubCoord && branchCoord
          ? [branchCoord, hubCoord]
          : [];
    pushLine("return", returnPath);
  }
  if (
    droneCoord &&
    branchCoord &&
    (normalizedStage === "to_restaurant" || normalizedStage === "arriving") &&
    !hubToBranchPath.length
  ) {
    pushLine("approach", [droneCoord, branchCoord]);
  }
  if (
    droneCoord &&
    customerCoord &&
    (normalizedStage === "to_customer" || normalizedStage === "delivered") &&
    !branchToCustomerPath.length
  ) {
    pushLine("active", [droneCoord, customerCoord]);
  }
  if (droneCoord && hubCoord && normalizedStage === "returning" && !hubToBranchPath.length) {
    pushLine("return", [droneCoord, hubCoord]);
  }

  pushPoint(hubCoord, "hub", "Drone Hub");
  pushPoint(branchCoord, "restaurant", "Restaurant");
  pushPoint(customerCoord, "customer", "Your Address");
  pushPoint(droneCoord, "drone", "Drone");

  return {
    lines: { type: "FeatureCollection", features },
    points: { type: "FeatureCollection", features: points },
    coords,
  };
};

const parseTelemetryNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeTelemetryEntry = (entry, delivery) => {
  if (!entry) return null;
  const deliveryId =
    entry.deliveryId ||
    entry.delivery_id ||
    delivery?.id ||
    delivery?.delivery_id ||
    null;
  const orderId =
    entry.orderId ||
    entry.order_id ||
    delivery?.order_id ||
    delivery?.orderId ||
    null;
  const position =
    entry.position ||
    (entry.lat != null && entry.lng != null
      ? { lat: Number(entry.lat), lng: Number(entry.lng) }
      : null);
  const status = entry.status || entry.deliveryStatus || delivery?.delivery_status || null;
  const etaSeconds = parseTelemetryNumber(entry.etaSeconds ?? entry.eta_seconds);
  const progressPercent = parseTelemetryNumber(
    entry.progressPercent ?? entry.progress_percent,
  );
  const distanceMeters = parseTelemetryNumber(
    entry.distanceMeters ?? entry.distance_meters,
  );
  const batteryLevel = parseTelemetryNumber(
    entry.batteryLevel ?? entry.battery_level ?? entry.battery,
  );
  const speed = parseTelemetryNumber(entry.speed ?? entry.velocity);
  const heading = parseTelemetryNumber(entry.heading);
  const stageSource = entry.stage || deriveStageFromStatus(status);
  return {
    deliveryId,
    orderId,
    droneId: entry.droneId || entry.drone_id || delivery?.drone?.id || null,
    position,
    batteryLevel,
    speed,
    heading,
    status,
    stage: stageSource || "to_restaurant",
    progressPercent,
    etaSeconds,
    distanceMeters,
    deliveryStatus: status,
    recordedAt: entry.recordedAt || entry.created_at || null,
    receivedAt: entry.receivedAt || entry.created_at || null,
  };
};

const normalizeTelemetryCollection = (entries, delivery) => {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => normalizeTelemetryEntry(entry, delivery)).filter(Boolean);
};

const formatSpeedLabel = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "--";
  return `${(numeric * 3.6).toFixed(1)} km/h`;
};

const formatCoordinateValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return numeric.toFixed(5);
};

const CurrentOrder = () => {
  const {
    user,
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
  const navigate = useNavigate();
  const requestedOrderId = location.state?.orderId || null;

  const [trackedOrderId, setTrackedOrderId] = useState(requestedOrderId || null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const pendingRefreshRef = useRef(false);
  const [droneLiveData, setDroneLiveData] = useState(null);
  const [socketState, setSocketState] = useState("idle");
  const [deliveryDetail, setDeliveryDetail] = useState(null);
  const [deliveryDetailLoading, setDeliveryDetailLoading] = useState(false);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [detailRefreshTick, setDetailRefreshTick] = useState(0);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapReadyRef = useRef(false);
  const mapFitRef = useRef(false);
  const detailRefreshTimerRef = useRef(null);
  const pendingRedirectRef = useRef(false);
  const completedRedirectRef = useRef(false);

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
    if (requestedOrderId) {
      setTrackedOrderId(requestedOrderId);
    }
  }, [requestedOrderId]);

  useEffect(() => {
    if (trackedOrderId && !order && !pendingRedirectRef.current) {
      pendingRedirectRef.current = true;
      navigate('/', { replace: true });
    }
  }, [trackedOrderId, order, navigate]);

  useEffect(() => {
    setDroneLiveData(null);
    setTelemetryHistory([]);
    mapFitRef.current = false;
  }, [order?.id]);
  
  const loadTelemetryLogs = useCallback(
    async (deliveryData) => {
      if (!order?.id || !deliveryData?.id) {
        return;
      }
      const params = {};
      if (user?.id) {
        params.customerId = user.id;
      }
      try {
        const logsResponse = await api.get(
          `/api/customer/deliveries/orders/${order.id}/logs`,
          { params: { ...params, limit: 40 } },
        );
        const logsPayload = Array.isArray(logsResponse?.data?.logs)
          ? logsResponse.data.logs
          : Array.isArray(logsResponse?.data?.data)
            ? logsResponse.data.data
            : [];
        if (logsPayload.length) {
          const normalizedLogs = normalizeTelemetryCollection(logsPayload, deliveryData);
          setTelemetryHistory(normalizedLogs);
          setDroneLiveData((prev) => prev || normalizedLogs[0] || null);
        } else {
          setTelemetryHistory([]);
        }
      } catch (error) {
        console.warn("[CurrentOrder] failed to load telemetry logs", error?.message || error);
        setTelemetryHistory([]);
      }
    },
    [order?.id, user?.id],
  );

  useEffect(() => {
    if (!order?.id) {
      setDeliveryDetail(null);
      setTelemetryHistory([]);
      return;
    }
    let cancelled = false;
    setDeliveryDetailLoading(true);
    const params = {};
    if (user?.id) {
      params.customerId = user.id;
    }

    const fetchDeliveryDetail = async () => {
      try {
        const detailResponse = await api.get(
          `/api/customer/deliveries/orders/${order.id}`,
          { params },
        );
        if (cancelled) return;
        const deliveryData = detailResponse?.data?.data || null;
        setDeliveryDetail(deliveryData);
        if (!deliveryData?.id) {
          setTelemetryHistory([]);
          return;
        }
        if (!cancelled) {
          await loadTelemetryLogs(deliveryData);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[CurrentOrder] failed to load delivery detail", error?.message || error);
          setDeliveryDetail(null);
          setTelemetryHistory([]);
        }
      } finally {
        if (!cancelled) {
          setDeliveryDetailLoading(false);
        }
      }
    };

    fetchDeliveryDetail();
    return () => {
      cancelled = true;
    };
  }, [order?.id, user?.id, detailRefreshTick, loadTelemetryLogs]);

  useEffect(() => {
    if (!order?.id || !deliveryDetail?.id) {
      if (detailRefreshTimerRef.current) {
        clearTimeout(detailRefreshTimerRef.current);
        detailRefreshTimerRef.current = null;
      }
      return undefined;
    }
    if (deliveryDetail?.drone_id) {
      if (detailRefreshTimerRef.current) {
        clearTimeout(detailRefreshTimerRef.current);
        detailRefreshTimerRef.current = null;
      }
      return undefined;
    }
    detailRefreshTimerRef.current = setTimeout(() => {
      setDetailRefreshTick((prev) => prev + 1);
    }, 5000);
    return () => {
      if (detailRefreshTimerRef.current) {
        clearTimeout(detailRefreshTimerRef.current);
        detailRefreshTimerRef.current = null;
      }
    };
  }, [order?.id, deliveryDetail?.id, deliveryDetail?.drone_id]);

  useEffect(() => {
    if (!deliveryDetail?.id || !deliveryDetail?.drone_id) {
      return;
    }
    loadTelemetryLogs(deliveryDetail);
  }, [deliveryDetail?.drone_id, deliveryDetail?.id, loadTelemetryLogs]);

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

  useEffect(() => {
    if (
      order &&
      normalisedStatus === 'completed' &&
      !completedRedirectRef.current
    ) {
      completedRedirectRef.current = true;
      navigate('/orders/history', { replace: true });
    }
  }, [order, normalisedStatus, navigate]);

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
  const deliveryDetails = deliveryDetail || order?.delivery || (order?.metadata?.delivery ?? null);
  const deliveryAddress =
    deliveryDetails?.delivery_address ||
    order.deliveryAddress ||
    deliveryDetails?.delivery_address_snapshot ||
    {};
  const droneDetails =
    deliveryDetails?.drone ||
    deliveryDetails?.drone_snapshot ||
    deliveryDetails?.droneInfo ||
    null;
  const droneCode = droneDetails?.code || droneDetails?.identifier || droneDetails?.name || null;
  const droneModel = droneDetails?.model || droneDetails?.drone_model || null;
  const rawBattery =
    droneDetails?.battery_level ?? droneDetails?.batteryLevel ?? null;
  const droneBatteryLevel =
    typeof rawBattery === "number" ? Math.max(0, Math.min(100, rawBattery)) : null;
  const droneStatus =
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
  const baseDronePositionLabel =
    lastKnownPosition && typeof lastKnownPosition === "object"
      ? lastKnownPosition.formatted ||
        lastKnownPosition.address ||
        (Array.isArray(lastKnownPosition.coordinates)
          ? `${lastKnownPosition.coordinates[0]}, ${lastKnownPosition.coordinates[1]}`
          : null)
      : null;
  const deliveryId =
    deliveryDetails?.id ||
    deliveryDetails?.delivery_id ||
    order?.deliveryId ||
    order?.delivery_id ||
    null;
  const assignedDroneId = useMemo(
    () =>
      deliveryDetails?.drone_id ||
      deliveryDetails?.drone?.id ||
      deliveryDetails?.drone_snapshot?.id ||
      deliveryDetails?.drone_snapshot?.drone_id ||
      null,
    [deliveryDetails],
  );
  useEffect(() => {
    if (!deliveryDetails || telemetryHistory.length > 0) {
      return;
    }
    const basePosition =
      deliveryDetails.current_position ||
      deliveryDetails.currentPosition ||
      deliveryDetails.drone?.last_known_position ||
      deliveryDetails.drone_snapshot?.last_known_position ||
      deliveryDetails.branch_location ||
      deliveryDetails.drone?.hub?.location ||
      null;
    if (!basePosition) {
      return;
    }
    const derivedStage = deriveStageFromStatus(
      deliveryDetails.delivery_status || droneStatus || "to_restaurant",
    );
    const fallbackEntry = normalizeTelemetryEntry(
      {
        deliveryId,
        stage: derivedStage || "to_restaurant",
        status: deliveryDetails.delivery_status || droneStatus || "to_restaurant",
        position: basePosition,
        batteryLevel:
          deliveryDetails?.drone?.battery_level ??
          deliveryDetails?.drone_snapshot?.battery_level ??
          droneBatteryLevel ??
          null,
        recordedAt:
          deliveryDetails.updated_at ||
          deliveryDetails.pickup_at ||
          deliveryDetails.created_at ||
          new Date().toISOString(),
      },
      deliveryDetails,
    );
    if (fallbackEntry) {
      setTelemetryHistory([fallbackEntry]);
      setDroneLiveData((prev) => prev || fallbackEntry);
    }
  }, [
    deliveryDetails,
    deliveryId,
    droneStatus,
    droneBatteryLevel,
    telemetryHistory.length,
  ]);
  const fallbackStage = deriveStageFromStatus(
    deliveryDetails?.delivery_status || droneStatus,
  );
  const effectiveStage = droneLiveData?.stage || fallbackStage;
  const effectiveBatteryLevel =
    typeof droneLiveData?.batteryLevel === "number"
      ? Math.max(0, Math.min(100, Math.round(droneLiveData.batteryLevel)))
      : droneBatteryLevel;
  const effectiveEtaSeconds =
    typeof droneLiveData?.etaSeconds === "number" && droneLiveData.etaSeconds >= 0
      ? droneLiveData.etaSeconds
      : droneEtaSeconds;
  const effectiveProgress =
    typeof droneLiveData?.progressPercent === "number"
      ? Math.max(0, Math.min(100, droneLiveData.progressPercent))
      : droneProgress;
  const effectiveSpeed =
    typeof droneLiveData?.speed === "number" ? droneLiveData.speed : null;
  const effectivePosition =
    (droneLiveData && (droneLiveData.position || droneLiveData.current_position)) ||
    lastKnownPosition ||
    null;
  const stageMessage = formatStageMessage(effectiveStage, friendlyDroneStatus);
  const stagePillClassName = stageBadgeClass(effectiveStage);
  const etaLabelLive =
    typeof effectiveEtaSeconds === "number" && effectiveEtaSeconds > 0
      ? formatEta(effectiveEtaSeconds)
      : droneEtaLabel;
  const speedLabel = formatSpeedLabel(effectiveSpeed);
  const liveUpdatedLabel = droneLiveData?.recordedAt
    ? new Date(droneLiveData.recordedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const socketStatusBadge =
    socketState === "connected"
      ? "bg-emerald-100 text-emerald-700"
      : socketState === "disconnected"
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-500";
  const socketStatusLabel =
    socketState === "connected"
      ? "Live"
      : socketState === "disconnected"
      ? "Reconnecting..."
      : "Connecting...";
  const branchCoordinate = useMemo(
    () => toLngLat(deliveryDetails?.branch_location),
    [deliveryDetails],
  );
  const customerCoordinate = useMemo(
    () =>
      toLngLat(
        deliveryDetails?.delivery_address?.location ||
          deliveryDetails?.delivery_address ||
          deliveryAddress?.location ||
          deliveryAddress,
      ),
    [deliveryDetails, deliveryAddress],
  );
  const hubCoordinate = useMemo(
    () =>
      toLngLat(
        deliveryDetails?.drone?.hub?.location ||
          deliveryDetails?.hub_location ||
          deliveryDetails?.drone_snapshot?.hub?.location ||
          order?.assigned_hub_location ||
          order?.metadata?.assigned_hub_location ||
          order?.assignedHub?.location,
      ),
    [deliveryDetails, order],
  );
  const droneCoordinate = useMemo(
    () => toLngLat(effectivePosition),
    [effectivePosition],
  );
  const mapData = useMemo(
    () =>
      buildCustomerMapData({
        hubCoord: hubCoordinate,
        branchCoord: branchCoordinate,
        customerCoord: customerCoordinate,
        droneCoord: droneCoordinate,
        stage: effectiveStage,
        route: deliveryDetails?.route,
      }),
    [hubCoordinate, branchCoordinate, customerCoordinate, droneCoordinate, effectiveStage, deliveryDetails?.route],
  );
  const hasMapCoordinates = mapData.coords.length >= 1;
  const resolvedDronePositionLabel = droneCoordinate
    ? `${droneCoordinate[1].toFixed(4)}, ${droneCoordinate[0].toFixed(4)}`
    : baseDronePositionLabel || "Awaiting first location update";
  const progressDisplay =
    typeof effectiveProgress === "number" ? Math.round(effectiveProgress) : null;
  const rawStageStatus = (deliveryDetails?.delivery_status || normalisedStatus || "").toLowerCase();
  const stageStatus =
    rawStageStatus ||
    (deliveryDetails?.drone_id ||
    deliveryDetails?.drone?.id ||
    deliveryDetails?.drone_snapshot
      ? "to_restaurant"
      : rawStageStatus);
  const trackableStages = new Set(["assigned", "flying", "arriving", "delivering", "returning", "to_restaurant", "to_customer"]);
  const showDroneTracking =
    trackableStages.has(stageStatus) ||
    Boolean(
      (droneLiveData?.stage && droneLiveData.stage !== "landed") ||
        (telemetryHistory.length > 0 &&
          telemetryHistory.some((entry) => entry.stage && entry.stage !== "landed")),
    );

  useEffect(() => {
    if (!order?.id) {
      setSocketState("idle");
      return;
    }
    setSocketState("connecting");
    const socket = io(SOCKET_GATEWAY_URL, {
      transports: ["websocket"],
      query: {
        role: "customer",
        customerId: user?.id || "",
        orderId: order.id,
      },
    });
    const handleUpdate = (payload = {}) => {
      const payloadOrderId = payload.orderId || payload.order_id || null;
      const payloadDeliveryId = payload.deliveryId || payload.delivery_id || null;
      const payloadDroneId = payload.droneId || payload.drone_id || payload.drone?.id || null;
      const hasOrderInfo = Boolean(payloadOrderId);
      const hasDeliveryInfo = Boolean(payloadDeliveryId);
      const hasDroneInfo = Boolean(payloadDroneId && assignedDroneId);

      if (
        (hasOrderInfo && String(payloadOrderId) !== String(order.id)) ||
        (hasDeliveryInfo &&
          deliveryId &&
          String(payloadDeliveryId) !== String(deliveryId)) ||
        (hasDroneInfo && String(payloadDroneId) !== String(assignedDroneId))
      ) {
        return;
      }
      if (!hasOrderInfo && !hasDeliveryInfo && !hasDroneInfo) {
        return;
      }
      const enriched = {
        ...payload,
        receivedAt: new Date().toISOString(),
      };
      const normalizedEntry = normalizeTelemetryEntry(enriched, deliveryDetails);
      if (!normalizedEntry) {
        return;
      }
      const nextLive = { ...enriched, ...normalizedEntry };
      setDroneLiveData(nextLive);
      setTelemetryHistory((prev) => {
        const filtered = prev.filter(
          (item) =>
            !(
              item &&
              nextLive &&
              item.recordedAt === nextLive.recordedAt &&
              ((item.deliveryId &&
                nextLive.deliveryId &&
                String(item.deliveryId) === String(nextLive.deliveryId)) ||
                (item.droneId &&
                  nextLive.droneId &&
                  String(item.droneId) === String(nextLive.droneId)))
            ),
        );
        return [nextLive, ...filtered].slice(0, 10);
      });
    };
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("drone:update", handleUpdate);
    return () => {
      socket.off("drone:update", handleUpdate);
      socket.disconnect();
      setSocketState("idle");
    };
  }, [order?.id, deliveryId, user?.id, assignedDroneId, deliveryDetails]);
  const fallbackEtaLabel =
    typeof order?.etaMinutes === "number"
      ? `${order.etaMinutes} min`
      : "Updating";
  useEffect(() => {
    if (!showDroneTracking) {
      return;
    }
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }
    const defaultCenter = customerCoordinate || branchCoordinate || [106.7, 10.78];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: defaultCenter,
      zoom: 12,
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("order-lines", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("order-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "order-lines-delivery",
        type: "line",
        source: "order-lines",
        filter: ["==", ["get", "segment"], "delivery"],
        paint: {
          "line-color": "#f97316",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "order-lines-active",
        type: "line",
        source: "order-lines",
        filter: ["==", ["get", "segment"], "active"],
        paint: {
          "line-color": "#ea580c",
          "line-width": 5,
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "order-lines-approach",
        type: "line",
        source: "order-lines",
        filter: ["==", ["get", "segment"], "approach"],
        paint: {
          "line-color": "#06b6d4",
          "line-width": 3,
          "line-opacity": 0.85,
          "line-dasharray": [0.8, 1.2],
        },
      });
      map.addLayer({
        id: "order-lines-return",
        type: "line",
        source: "order-lines",
        filter: ["==", ["get", "segment"], "return"],
        paint: {
          "line-color": "#10b981",
          "line-width": 3,
          "line-opacity": 0.8,
          "line-dasharray": [1, 1.2],
        },
      });
      map.addLayer({
        id: "order-points",
        type: "circle",
        source: "order-points",
        paint: {
          "circle-radius": 7,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-color": [
            "match",
            ["get", "pointType"],
            "hub",
            "#6366f1",
            "restaurant",
            "#facc15",
            "customer",
            "#fb923c",
            "drone",
            "#0ea5e9",
            "#94a3b8",
          ],
        },
      });
      mapReadyRef.current = true;
    });
    return () => {
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, [branchCoordinate, customerCoordinate, showDroneTracking]);

  useEffect(() => {
    if (!showDroneTracking && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    }
  }, [showDroneTracking]);

  useEffect(() => {
    if (!showDroneTracking || !mapReadyRef.current || !mapRef.current) return;
    const map = mapRef.current;
    const lineSource = map.getSource("order-lines");
    if (lineSource) {
      lineSource.setData(mapData.lines);
    }
    const pointsSource = map.getSource("order-points");
    if (pointsSource) {
      pointsSource.setData(mapData.points);
    }
    if (!mapFitRef.current && mapData.coords.length) {
      const bounds = mapData.coords.reduce(
        (acc, coord) =>
          acc ? acc.extend(coord) : new maplibregl.LngLatBounds(coord, coord),
        null,
      );
      if (bounds) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        mapFitRef.current = true;
      }
    }
  }, [mapData, showDroneTracking]);

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
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                      Assigned drone
                    </p>
                    <h4 className="mt-2 text-xl font-semibold text-gray-900">
                      {droneCode || "Awaiting dispatch"}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {droneModel || "Drone details will appear once dispatched."}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {stageMessage}
                      {liveUpdatedLabel ? ` · Last update ${liveUpdatedLabel}` : ""}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${stagePillClassName}`}>
                      {stageMessage}
                    </span>
                    {deliveryDetailLoading ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                        Syncing…
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-6 grid gap-4 text-sm text-gray-600 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-gray-400">Battery</p>
                    <p className="font-semibold text-gray-900">
                      {effectiveBatteryLevel !== null ? `${effectiveBatteryLevel}%` : "Updating"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">ETA</p>
                    <p className="font-semibold text-gray-900">{etaLabelLive || fallbackEtaLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Speed</p>
                    <p className="font-semibold text-gray-900">{speedLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Location</p>
                    <p className="font-semibold text-gray-900">{resolvedDronePositionLabel}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 text-sm text-gray-600 md:grid-cols-3">
                  {droneDistanceLabel ? (
                    <div>
                      <p className="text-xs uppercase text-gray-400">Distance</p>
                      <p className="font-semibold text-gray-900">{droneDistanceLabel}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs uppercase text-gray-400">Delivery ID</p>
                    <p className="font-semibold text-gray-900">{deliveryId || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Status</p>
                    <p className="font-semibold text-gray-900">{stageMessage}</p>
                  </div>
                </div>
                {progressDisplay !== null ? (
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Flight progress</span>
                      <span>{progressDisplay}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, progressDisplay))}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Live drone map</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${socketStatusBadge}`}>
                    {socketStatusLabel}
                  </span>
                </div>
                <div className="relative mt-3 h-72 w-full rounded-2xl border border-gray-200">
                  <div ref={mapContainerRef} className="h-full w-full rounded-2xl" />
                  {!hasMapCoordinates ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 text-sm text-gray-500">
                      Waiting for live telemetry…
                    </div>
                  ) : null}
                </div>
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
