import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import api from '../../services/api';
import mapConfig from '../../config/mapConfig';

const mapLegend = [
  {
    label: 'Drone Positions',
    description: 'Live from drone_tracking_logs',
    indicator: 'bg-sky-500',
  },
  {
    label: 'Drone → Restaurant',
    description: 'Straight dashed path for pickup leg',
    indicator: 'bg-cyan-400',
  },
  {
    label: 'Restaurant → Customer',
    description: 'Active delivery leg',
    indicator: 'bg-orange-500',
  },
  {
    label: 'Customer → Hub',
    description: 'Return flight',
    indicator: 'bg-emerald-500',
  },
  {
    label: 'Hub Location',
    description: 'Origin hub pin',
    indicator: 'bg-indigo-500',
  },
  {
    label: 'Restaurant Location',
    description: 'Branch pickup pin',
    indicator: 'bg-yellow-400',
  },
  {
    label: 'Customer Location',
    description: 'Dropoff pin',
    indicator: 'bg-orange-500',
  },
];

const liveDeliveries = [
  // populated from API
];

const statusColorClass = (status) => {
  if (!status) return 'text-neutral-900';
  const normalized = status.toLowerCase();
  if (normalized.includes('fly')) return 'text-sky-600';
  if (normalized.includes('arriv')) return 'text-emerald-600';
  if (normalized.includes('assign')) return 'text-indigo-600';
  if (normalized.includes('pending')) return 'text-amber-600';
  return 'text-neutral-900';
};

const formatEta = (seconds) => {
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return '--';
  const mins = Math.max(1, Math.round(parsed / 60));
  return `${mins} min`;
};

const formatStageLabel = (stage, fallbackStatus) => {
  if (!stage && !fallbackStatus) return 'Active';
  const normalized = (stage || fallbackStatus || '').toLowerCase();
  switch (normalized) {
    case 'to_restaurant':
      return 'Heading to restaurant';
    case 'arriving':
      return 'Arriving at restaurant';
    case 'to_customer':
      return 'Delivering to customer';
    case 'delivered':
      return 'Delivered';
    case 'returning':
      return 'Returning to hub';
    case 'landed':
      return 'At hub';
    default:
      return (fallbackStatus || normalized || 'Active')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

const stageBadgeClass = (stage) => {
  const normalized = (stage || '').toLowerCase();
  if (normalized === 'arriving') return 'bg-amber-100 text-amber-700';
  if (normalized === 'to_customer') return 'bg-orange-100 text-orange-700';
  if (normalized === 'delivered') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'returning' || normalized === 'landed') return 'bg-indigo-100 text-indigo-700';
  if (normalized === 'to_restaurant') return 'bg-sky-100 text-sky-700';
  return 'bg-neutral-100 text-neutral-600';
};

const deriveStageFromStatus = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'arriving') return 'arriving';
  if (normalized === 'delivering' || normalized === 'flying') return 'to_customer';
  if (normalized === 'assigned' || normalized === 'pending') return 'to_restaurant';
  if (normalized === 'returning') return 'returning';
  if (normalized === 'completed') return 'delivered';
  return normalized || null;
};

const SOCKET_GATEWAY_URL =
  import.meta.env.VITE_SOCKET_GATEWAY_URL || 'https://26.62.36.103:4000';
const CUSTOM_MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || '';
const MAP_STYLE = CUSTOM_MAP_STYLE || mapConfig.styleUrl;
const MAX_DRONE_EVENTS = 20;

const formatCoordinate = (value) => {
  if (typeof value !== 'number') return '--';
  return value.toFixed(5);
};

const toStreamEntry = (drone) => {
  if (!drone) return null;
  const position =
    drone.last_known_position && typeof drone.last_known_position === 'object'
      ? drone.last_known_position
      : null;
  return {
    droneId: drone.id,
    code: drone.code,
    position,
    batteryLevel: drone.battery_level,
    status: drone.status,
    speed: null,
    heading: null,
    deliveryId: null,
    recordedAt: drone.last_active_at || drone.updated_at || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
};

const isNumber = (value) => Number.isFinite(Number(value));

const toLngLat = (point) => {
  if (!point || typeof point !== 'object') return null;
  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(
    point.lng ?? point.lon ?? point.long ?? point.longitude,
  );
  if (!isNumber(lat) || !isNumber(lng)) return null;
  return [lng, lat];
};

const decodePolyline = (str = '') => {
  // Lightweight polyline decoder (OSRM/Google) returning [[lat,lng], ...]
  const output = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    output.push([lat * 1e-5, lng * 1e-5]);
  }
  return output;
};

const extractRouteCoordinates = (route) => {
  if (!route) return [];
  const source = route || {};
  const polyline = source.polyline ?? source.geometry ?? source.path ?? null;

  if (Array.isArray(polyline)) {
    const coords = polyline
      .map((entry) => {
        if (Array.isArray(entry) && entry.length >= 2) {
          const lng = Number(entry[0]);
          const lat = Number(entry[1]);
          return isNumber(lat) && isNumber(lng) ? [lng, lat] : null;
        }
        return toLngLat(entry);
      })
      .filter(Boolean);
    if (coords.length) return coords;
  }

  if (typeof polyline === 'string' && polyline.trim().length) {
    const decoded = decodePolyline(polyline.trim());
    if (decoded.length) return decoded.map(([lat, lng]) => [lng, lat]);
  }

  if (Array.isArray(source.waypoints)) {
    const coords = source.waypoints.map(toLngLat).filter(Boolean);
    if (coords.length) return coords;
  }

  return [];
};

const resolveCustomerCoordinate = (delivery, routeCoords = []) => {
  const addressCoord =
    toLngLat(delivery?.delivery_address) || toLngLat(delivery?.delivery_address?.location);
  if (addressCoord) return addressCoord;
  if (routeCoords.length) return routeCoords[routeCoords.length - 1];
  const fallback =
    toLngLat(delivery?.current_position) ||
    toLngLat(delivery?.drone?.last_known_position);
  return fallback;
};

const buildDeliveryFeatures = (deliveries = [], telemetry = []) => {
  const routeFeatures = [];
  const pointFeatures = [];
  const telemetryByDeliveryId = new Map();
  const telemetryByDroneId = new Map();

  telemetry.forEach((entry) => {
    if (!entry) return;
    const deliveryId = entry.deliveryId ? String(entry.deliveryId) : null;
    const droneId = entry.droneId ? String(entry.droneId) : null;
    if (deliveryId && !telemetryByDeliveryId.has(deliveryId)) {
      telemetryByDeliveryId.set(deliveryId, entry);
    }
    if (droneId && !telemetryByDroneId.has(droneId)) {
      telemetryByDroneId.set(droneId, entry);
    }
  });

  const pushRouteFeature = (coordinates, segmentType, properties = {}) => {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return;
    const normalized = coordinates
      .map((coord) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;
        const lng = Number(coord[0]);
        const lat = Number(coord[1]);
        if (!isNumber(lng) || !isNumber(lat)) return null;
        return [lng, lat];
      })
      .filter(Boolean);
    if (normalized.length < 2) return;
    routeFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: normalized,
      },
      properties: {
        segmentType,
        ...properties,
      },
    });
  };

  deliveries.forEach((delivery) => {
    const deliveryIdRaw = delivery.id || delivery.order_id || `delivery-${Math.random()}`;
    const deliveryId = deliveryIdRaw ? String(deliveryIdRaw) : null;
    const deliveryStatus = delivery.delivery_status || delivery.status || 'active';
    const droneId = delivery?.drone?.id || delivery?.drone_id || null;
    const telemetryEntry =
      (deliveryId && telemetryByDeliveryId.get(deliveryId)) ||
      (droneId && telemetryByDroneId.get(String(droneId))) ||
      null;
    const normalizedStage =
      telemetryEntry?.stage ||
      deriveStageFromStatus(telemetryEntry?.status) ||
      deriveStageFromStatus(deliveryStatus) ||
      'to_restaurant';

    const hubCoord = toLngLat(delivery?.drone?.hub?.location);
    const shopCoord = toLngLat(delivery?.branch_location);
    let routeCoords = extractRouteCoordinates(delivery?.route);
    const customerCoord = resolveCustomerCoordinate(delivery, routeCoords);

    if (routeCoords.length < 2) {
      const fallbackPath = [hubCoord, shopCoord, customerCoord].filter(Boolean);
      if (fallbackPath.length >= 2) {
        routeCoords = fallbackPath.reduce((acc, point) => {
          if (!acc.length) return [point];
          const prev = acc[acc.length - 1];
          if (prev[0] !== point[0] || prev[1] !== point[1]) {
            acc.push(point);
          }
          return acc;
        }, []);
      } else {
        const currentCoord = toLngLat(delivery?.current_position);
        const droneCoord = toLngLat(delivery?.drone?.last_known_position);
        const startCoord = hubCoord || shopCoord || currentCoord || droneCoord || null;
        const endCoord = customerCoord || currentCoord || null;
        if (
          startCoord &&
          endCoord &&
          (startCoord[0] !== endCoord[0] || startCoord[1] !== endCoord[1])
        ) {
          routeCoords = [startCoord, endCoord];
        }
      }
    }

    if (routeCoords.length >= 2) {
      pushRouteFeature(routeCoords, 'restaurant-to-customer', {
        deliveryId,
        status: deliveryStatus,
      });
    }

    const telemetryCoord = toLngLat(telemetryEntry?.position);
    const droneCoord =
      telemetryCoord ||
      toLngLat(delivery?.current_position) ||
      toLngLat(delivery?.drone?.last_known_position);
    if (
      droneCoord &&
      shopCoord &&
      (droneCoord[0] !== shopCoord[0] || droneCoord[1] !== shopCoord[1])
    ) {
      pushRouteFeature([droneCoord, shopCoord], 'drone-to-restaurant', {
        deliveryId,
        status: deliveryStatus,
      });
    }

    if (
      droneCoord &&
      hubCoord &&
      normalizedStage === 'returning' &&
      (droneCoord[0] !== hubCoord[0] || droneCoord[1] !== hubCoord[1])
    ) {
      pushRouteFeature([droneCoord, hubCoord], 'return-to-hub', {
        deliveryId,
        status: normalizedStage,
      });
    }

    const directTarget =
      normalizedStage === 'returning'
        ? hubCoord
        : normalizedStage === 'to_customer' || normalizedStage === 'delivered'
        ? customerCoord
        : normalizedStage === 'arriving' || normalizedStage === 'to_restaurant'
        ? shopCoord
        : null;
    const directType =
      normalizedStage === 'returning'
        ? 'drone-direct-return'
        : normalizedStage === 'to_customer' || normalizedStage === 'delivered'
        ? 'drone-direct-delivery'
        : normalizedStage === 'arriving' || normalizedStage === 'to_restaurant'
        ? 'drone-direct-pickup'
        : null;
    if (
      droneCoord &&
      directTarget &&
      directType &&
      (droneCoord[0] !== directTarget[0] || droneCoord[1] !== directTarget[1])
    ) {
      pushRouteFeature([droneCoord, directTarget], directType, {
        deliveryId,
        status: normalizedStage || deliveryStatus,
      });
    }

    const pushPoint = (coord, pointType, title) => {
      if (!coord) return;
      pointFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coord },
        properties: { pointType, title, deliveryId },
      });
    };

    pushPoint(hubCoord, 'hub', delivery?.drone?.hub?.name || 'Hub');
    pushPoint(shopCoord, 'restaurant', 'Restaurant Branch');
    pushPoint(customerCoord, 'customer', 'Customer');
  });

  return {
    routeFeatures,
    pointFeatures,
  };
};

const toDeliveryDroneEntry = (delivery) => {
  if (!delivery || !delivery.drone) return null;
  const droneId = delivery.drone.id || delivery.drone_id || null;
  if (!droneId) return null;
  const position =
    delivery.current_position ||
    delivery.drone.last_known_position ||
    delivery.branch_location ||
    delivery.delivery_address ||
    delivery.drone?.hub?.location ||
    null;
  if (!position) return null;
  const battery = Number.isFinite(Number(delivery.drone.battery_level))
    ? Number(delivery.drone.battery_level)
    : null;
  return {
    droneId,
    code: delivery.drone.code || 'Drone',
    position,
    batteryLevel: battery,
    status: delivery.delivery_status || delivery.drone.status || 'active',
    deliveryId: delivery.id ? String(delivery.id) : null,
    recordedAt: delivery.updated_at || delivery.pickup_at || '',
  };
};

const AdminDeliveryTracking = () => {
  const [showMapLayers, setShowMapLayers] = useState(false);
  const [droneTelemetry, setDroneTelemetry] = useState([]);
  const [socketState, setSocketState] = useState('connecting');
  const [trackingMetrics, setTrackingMetrics] = useState({
    activeDeliveries: 0,
    avgEtaMinutes: 0,
    delayedAlerts: 0,
  });
  const [deliveries, setDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapReadyRef = useRef(false);
  const hasFitRef = useRef(false);
  const popupRef = useRef(null);
  const HIGHLIGHT_CLEAR = '__never__';

  const deliveryGeo = useMemo(
    () => buildDeliveryFeatures(deliveries, droneTelemetry),
    [deliveries, droneTelemetry],
  );

  const liveDroneStream = useMemo(() => {
    const entries = [];
    const seen = new Set();
    const deliveryMap = new Map(
      deliveries
        .filter((delivery) => delivery?.id)
        .map((delivery) => [String(delivery.id), delivery]),
    );

    droneTelemetry.forEach((entry) => {
      if (!entry?.deliveryId) return;
      const deliveryId = String(entry.deliveryId);
      const delivery = deliveryMap.get(deliveryId);
      const stageOverride = deriveStageFromStatus(
        delivery?.delivery_status || delivery?.status || entry.status,
      );
      const resolvedStage =
        entry.stage || deriveStageFromStatus(entry.deliveryStatus || entry.status);
      entries.push({
        ...entry,
        stage: resolvedStage || stageOverride || null,
      });
      seen.add(deliveryId);
    });

    deliveries.forEach((delivery) => {
      const deliveryId = delivery?.id ? String(delivery.id) : null;
      if (!deliveryId || seen.has(deliveryId)) return;
      const stage = deriveStageFromStatus(delivery.delivery_status || delivery.status);
      if (!stage || stage === 'delivered') return;
      const fallback = toDeliveryDroneEntry(delivery);
      entries.push({
        droneId: fallback?.droneId || delivery?.drone?.id || deliveryId,
        code: fallback?.code || delivery?.drone?.code || deliveryId,
        position: fallback?.position || delivery?.current_position || null,
        batteryLevel:
          fallback?.batteryLevel ?? delivery?.drone?.battery_level ?? delivery?.drone_snapshot?.battery_level ?? null,
        status: stage,
        deliveryId,
        stage,
        etaSeconds: delivery?.estimated_time_sec ?? null,
        progressPercent: delivery?.progress_percent ?? null,
        receivedAt: delivery?.updated_at || new Date().toISOString(),
        recordedAt: delivery?.pickup_at || delivery?.created_at || '',
      });
      seen.add(deliveryId);
    });

    return entries.filter((entry) => entry.deliveryId && entry.stage && entry.stage !== 'landed');
  }, [droneTelemetry, deliveries]);

  const sidebarDeliveries = useMemo(() => {
    const allowed = new Set(['assigned', 'flying', 'arriving', 'to_restaurant', 'to_customer', 'returning']);
    return deliveries
      .filter((delivery) => {
        const status = (delivery.delivery_status || delivery.status || '').toLowerCase();
        return allowed.has(status);
      })
      .map((delivery) => {
        const telemetryMatch = liveDroneStream.find(
          (entry) =>
            entry?.deliveryId &&
            delivery.id &&
            String(entry.deliveryId) === String(delivery.id),
        );
        if (!telemetryMatch) return delivery;
        const override = { ...delivery };
        if (typeof telemetryMatch.progressPercent === 'number') {
          override.progress_percent = telemetryMatch.progressPercent;
        }
        if (typeof telemetryMatch.etaSeconds === 'number') {
          override.estimated_time_sec = telemetryMatch.etaSeconds;
        }
        if (typeof telemetryMatch.batteryLevel === 'number') {
          if (!override.drone) override.drone = {};
          override.drone.battery_level = telemetryMatch.batteryLevel;
        }
        if (telemetryMatch.stage) {
          override.delivery_status = telemetryMatch.stage;
        }
        return override;
      });
  }, [deliveries, liveDroneStream]);

  const handleViewRoute = useCallback(
    (delivery) => {
      if (!delivery) return;
      const rawId = delivery.id || delivery.order_id;
      if (!rawId) return;
      const deliveryId = String(rawId);
      setSelectedDeliveryId(deliveryId);

      if (!mapReadyRef.current || !mapRef.current) return;
      const map = mapRef.current;

      const coords = [];
      deliveryGeo.routeFeatures.forEach((feature) => {
        if (feature?.properties?.deliveryId === deliveryId && feature.geometry?.coordinates) {
          feature.geometry.coordinates.forEach((coord) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              coords.push(coord);
            }
          });
        }
      });
      deliveryGeo.pointFeatures.forEach((feature) => {
        if (feature?.properties?.deliveryId === deliveryId && feature.geometry?.coordinates) {
          coords.push(feature.geometry.coordinates);
        }
      });
      const telemetryMatch = droneTelemetry.find(
        (entry) =>
          entry?.deliveryId &&
          String(entry.deliveryId) === deliveryId &&
          toLngLat(entry.position),
      );
      if (telemetryMatch) {
        coords.push(toLngLat(telemetryMatch.position));
      } else {
        const fallbackCoord =
          toLngLat(delivery.current_position) ||
          toLngLat(delivery.drone?.last_known_position) ||
          toLngLat(delivery.branch_location) ||
          toLngLat(delivery.drone?.hub?.location);
        if (fallbackCoord) {
          coords.push(fallbackCoord);
        }
      }

      if (!coords.length) return;

      try {
        const bounds = coords.reduce(
          (acc, coord) =>
            acc ? acc.extend(coord) : new maplibregl.LngLatBounds(coord, coord),
          null,
        );
        if (bounds) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 });
        }
      } catch (err) {
        const first = coords[0];
        if (Array.isArray(first)) {
          map.flyTo({ center: first, zoom: 13 });
        }
      }
    },
    [deliveryGeo, droneTelemetry],
  );

  const loadDeliveries = () => {
    setLoadingDeliveries(true);
    api
      .get('/api/admin/deliveries', { params: { status: 'active', limit: 20 } })
      .then((res) => {
        const items = Array.isArray(res?.data?.data) ? res.data.data : [];
        setDeliveries(items);
        const metrics = res?.data?.metrics || {};
        setTrackingMetrics({
          activeDeliveries: metrics.activeDeliveries ?? items.length,
          avgEtaMinutes: metrics.avgEtaSeconds
            ? Math.max(1, Math.round(Number(metrics.avgEtaSeconds) / 60))
            : 0,
          delayedAlerts: metrics.delayedAlerts ?? 0,
        });
      })
      .catch((err) => {
        console.warn('[AdminDeliveryTracking] load deliveries failed', err?.message || err);
      })
      .finally(() => setLoadingDeliveries(false));
  };

  useEffect(() => {
    // Seed with current drones (last known positions) so UI is not empty.
    api
      .get('/api/admin/drones?status=active')
      .then((res) => {
        const items = Array.isArray(res?.data?.data) ? res.data.data : [];
        const seeded = items.map(toStreamEntry).filter((entry) => entry && entry.position);
        if (seeded.length) {
          setDroneTelemetry(seeded.slice(0, MAX_DRONE_EVENTS));
        }
      })
      .catch((err) => {
        console.warn('[AdminDeliveryTracking] seed drones failed', err?.message || err);
      });

    loadDeliveries();

    const socket = io(SOCKET_GATEWAY_URL, {
      transports: ['websocket'],
      query: { role: 'admin' },
    });

    socket.on('connect', () => setSocketState('connected'));
    socket.on('disconnect', () => setSocketState('disconnected'));

    socket.on('drone:update', (payload) => {
      setDroneTelemetry((prev) => {
        const fresh = {
          ...payload,
          receivedAt: new Date().toISOString(),
        };
        const withoutDup = prev.filter((item) => item.droneId !== fresh.droneId);
        const next = [fresh, ...withoutDup];
        next.length = Math.min(next.length, MAX_DRONE_EVENTS);
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mapFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mapFullscreen]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [106.7, 10.78],
      zoom: 11,
      attributionControl: true,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    let handleClick;
    let handleEnter;
    let handleLeave;
    let handleClear;
    const highlightLayerId = 'deliveries-routes-highlight';

    const applyHighlight = (deliveryId) => {
      const match = deliveryId ? String(deliveryId) : HIGHLIGHT_CLEAR;
      setSelectedDeliveryId(deliveryId || null);
      if (map.getLayer(highlightLayerId)) {
        const filter = ['==', ['coalesce', ['get', 'deliveryId'], '__null__'], match];
        map.setFilter(highlightLayerId, filter);
        map.setLayoutProperty(
          highlightLayerId,
          'visibility',
          deliveryId ? 'visible' : 'none',
        );
      }
    };

    map.on('load', () => {
      map.addSource('deliveries-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('deliveries-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('drones-live', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'deliveries-routes-line',
        type: 'line',
        source: 'deliveries-routes',
        paint: {
          'line-color': '#f97316',
          'line-width': 4,
          'line-opacity': 0.95,
          'line-blur': 0.2,
        },
        layout: {
          visibility: 'visible',
        },
        filter: [
          'any',
          ['!', ['has', 'segmentType']],
          ['==', ['get', 'segmentType'], 'restaurant-to-customer'],
        ],
      });

      map.addLayer({
        id: 'deliveries-routes-approach',
        type: 'line',
        source: 'deliveries-routes',
        paint: {
          'line-color': '#06b6d4',
          'line-width': 3,
          'line-opacity': 0.85,
          'line-dasharray': [0.8, 1.2],
        },
        layout: {
          visibility: 'visible',
        },
        filter: ['==', ['get', 'segmentType'], 'drone-to-restaurant'],
      });

      map.addLayer({
        id: 'deliveries-routes-return',
        type: 'line',
        source: 'deliveries-routes',
        paint: {
          'line-color': '#10b981',
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [1, 1.2],
        },
        layout: {
          visibility: 'visible',
        },
        filter: ['==', ['get', 'segmentType'], 'return-to-hub'],
      });

      map.addLayer({
        id: 'deliveries-routes-direct',
        type: 'line',
        source: 'deliveries-routes',
        filter: [
          'match',
          ['get', 'segmentType'],
          ['drone-direct-pickup', 'drone-direct-delivery', 'drone-direct-return'],
          true,
          false,
        ],
        paint: {
          'line-color': [
            'match',
            ['get', 'segmentType'],
            'drone-direct-pickup',
            '#38bdf8',
            'drone-direct-return',
            '#10b981',
            'drone-direct-delivery',
            '#fb923c',
            '#f97316',
          ],
          'line-width': 4,
          'line-opacity': 0.95,
          'line-dasharray': [
            'case',
            ['==', ['get', 'segmentType'], 'drone-direct-pickup'],
            ['literal', [0.5, 0.8]],
            ['==', ['get', 'segmentType'], 'drone-direct-return'],
            ['literal', [0.8, 1.2]],
            ['literal', [1, 0]],
          ],
        },
      });

      map.addLayer({
        id: 'deliveries-points-circle',
        type: 'circle',
        source: 'deliveries-points',
        paint: {
          'circle-radius': 7,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-color': [
            'match',
            ['get', 'pointType'],
            'hub',
            '#6366f1',
            'restaurant',
            '#facc15',
            'customer',
            '#f59e0b',
            '#6b7280',
          ],
        },
      });

      map.addLayer({
        id: 'deliveries-points-labels',
        type: 'symbol',
        source: 'deliveries-points',
        layout: {
          'text-field': [
            'match',
            ['get', 'pointType'],
            'hub',
            'H',
            'restaurant',
            'R',
            'customer',
            'C',
            '',
          ],
          'text-size': 12,
          'text-offset': [0, 1.1],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });

      map.addLayer({
        id: 'deliveries-routes-highlight',
        type: 'line',
        source: 'deliveries-routes',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'segmentType'], 'drone-to-restaurant'],
            '#06b6d4',
            ['==', ['get', 'segmentType'], 'return-to-hub'],
            '#10b981',
            ['==', ['get', 'segmentType'], 'drone-direct-pickup'],
            '#38bdf8',
            ['==', ['get', 'segmentType'], 'drone-direct-return'],
            '#10b981',
            ['==', ['get', 'segmentType'], 'drone-direct-delivery'],
            '#fb923c',
            '#f97316',
          ],
          'line-width': 6,
          'line-opacity': 0.9,
          'line-dasharray': [
            'case',
            ['==', ['get', 'segmentType'], 'drone-to-restaurant'],
            ['literal', [0.8, 1.2]],
            ['==', ['get', 'segmentType'], 'return-to-hub'],
            ['literal', [1, 1.2]],
            ['==', ['get', 'segmentType'], 'drone-direct-pickup'],
            ['literal', [0.5, 0.8]],
            ['==', ['get', 'segmentType'], 'drone-direct-return'],
            ['literal', [0.8, 1.2]],
            ['literal', [1, 0]],
          ],
        },
        layout: {
          visibility: 'none',
        },
        filter: ['==', ['get', 'deliveryId'], '__none__'],
      });

      map.addLayer({
        id: 'drones-live-circle',
        type: 'circle',
        source: 'drones-live',
        paint: {
          'circle-radius': 9,
          'circle-color': [
            'match',
            ['downcase', ['coalesce', ['get', 'status'], '']],
            'flying',
            '#0ea5e9', // bright sky for active flight
            'assigned',
            '#0ea5e9',
            'arriving',
            '#14b8a6', // teal for approaching
            'charging',
            '#a855f7', // purple while charging
            'idle',
            '#94a3b8', // grey for idle
            '#0ea5e9',
          ],
          'circle-opacity': 0.95,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      handleClick = (event) => {
        const feature =
          (event.features && event.features[0]) ||
          map.queryRenderedFeatures(event.point, { layers: ['drones-live-circle'] })[0];
        if (!feature) return;
        let coords = feature.geometry?.coordinates;
        if (!coords) return;
        if (Array.isArray(coords[0])) coords = coords[0];

        const props = feature.properties || {};
        const code = props.code || props.droneId || 'Drone';
        const batteryValue = Number(props.battery);
        const battery =
          Number.isFinite(batteryValue) && batteryValue >= 0 ? `${batteryValue}%` : '--';
        const status = props.status || 'unknown';
        const stage = props.stage || null;
        const etaSeconds = Number(props.etaSeconds);
        const etaLabel =
          Number.isFinite(etaSeconds) && etaSeconds > 0
            ? `${Math.max(1, Math.round(etaSeconds / 60))} min`
            : '--';
        const progressValue = Number(props.progressPercent);
        const progressLabel =
          Number.isFinite(progressValue) && progressValue >= 0 ? `${progressValue}%` : '--';
        const deliveryId =
          props.deliveryId && props.deliveryId !== 'null' ? String(props.deliveryId) : null;
        const recordedAt = props.recordedAt || '';

        applyHighlight(deliveryId || null);

        if (popupRef.current) {
          popupRef.current.remove();
        }

        const popupHtml = `
          <div class="space-y-1 text-sm">
            <div class="font-semibold text-neutral-900">${code}</div>
            <div class="text-xs text-neutral-500">Status: ${status}</div>
            <div class="text-xs text-neutral-500">Stage: ${formatStageLabel(stage, status)}</div>
            <div class="text-xs text-neutral-500">Battery: ${battery}</div>
            <div class="text-xs text-neutral-500">Progress: ${progressLabel}</div>
            <div class="text-xs text-neutral-500">ETA: ${etaLabel}</div>
            <div class="text-xs text-neutral-500">Delivery: ${deliveryId || '--'}</div>
            ${recordedAt ? `<div class="text-[11px] text-neutral-400">Recorded: ${recordedAt}</div>` : ''}
          </div>
        `;

        const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(coords)
          .setHTML(popupHtml);
        popup.addTo(map);
        popupRef.current = popup;
      };

      handleEnter = () => {
        map.getCanvas().style.cursor = 'pointer';
      };
      handleLeave = () => {
        map.getCanvas().style.cursor = '';
      };

      map.on('click', 'drones-live-circle', handleClick);
      map.on('mouseenter', 'drones-live-circle', handleEnter);
      map.on('mouseleave', 'drones-live-circle', handleLeave);

      handleClear = (event) => {
        const hits = map.queryRenderedFeatures(event.point, {
          layers: ['drones-live-circle'],
        });
        if (!hits.length) {
          applyHighlight(null);
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
        }
      };
      map.on('click', handleClear);

      mapReadyRef.current = true;
      mapRef.current = map;
    });

    return () => {
      if (handleClick) {
        map.off('click', 'drones-live-circle', handleClick);
        map.off('mouseenter', 'drones-live-circle', handleEnter);
        map.off('mouseleave', 'drones-live-circle', handleLeave);
      }
      if (handleClear) {
        map.off('click', handleClear);
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      hasFitRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    const timeout = setTimeout(() => {
      if (mapReadyRef.current && mapRef.current) {
        mapRef.current.resize();
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [mapFullscreen]);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    const map = mapRef.current;

    const routes = {
      type: 'FeatureCollection',
      features: deliveryGeo.routeFeatures,
    };
    const points = {
      type: 'FeatureCollection',
      features: deliveryGeo.pointFeatures,
    };

    const fallbackEntries = deliveries.map(toDeliveryDroneEntry).filter(Boolean);
    const fallbackByDroneId = new Map(fallbackEntries.map((entry) => [entry.droneId, entry]));

    const telemetryEntries = droneTelemetry
      .filter((entry) => toLngLat(entry.position))
      .map((entry) => {
        const fallback = fallbackByDroneId.get(entry.droneId);
        const mergedDeliveryId = entry.deliveryId || fallback?.deliveryId || null;
        const mergedRecordedAt =
          entry.recordedAt || entry.receivedAt || fallback?.recordedAt || '';
        const mergedStatus = entry.status || fallback?.status || 'unknown';
        const mergedBattery =
          entry.batteryLevel !== undefined && entry.batteryLevel !== null
            ? entry.batteryLevel
            : fallback?.batteryLevel ?? null;
        const mergedPosition = entry.position || fallback?.position || null;
        const mergedStage = entry.stage || fallback?.stage || null;
        const mergedProgress =
          entry.progressPercent ?? fallback?.progressPercent ?? null;
        const mergedEta = entry.etaSeconds ?? fallback?.etaSeconds ?? null;
        const mergedDeliveryStatus =
          entry.deliveryStatus || fallback?.deliveryStatus || mergedStatus;
        const mergedSpeed = entry.speed ?? fallback?.speed ?? null;
        return {
          ...entry,
          position: mergedPosition,
          deliveryId: mergedDeliveryId,
          recordedAt: mergedRecordedAt,
          status: mergedStatus,
          batteryLevel: mergedBattery,
          stage: mergedStage,
          progressPercent: mergedProgress,
          etaSeconds: mergedEta,
          deliveryStatus: mergedDeliveryStatus,
          speed: mergedSpeed,
        };
      });

    const seenIds = new Set(telemetryEntries.map((entry) => entry.droneId));
    const deliveryFallbacks = fallbackEntries.filter((entry) => !seenIds.has(entry.droneId));

    const mergedDrones = [...telemetryEntries, ...deliveryFallbacks];

    const drones = {
      type: 'FeatureCollection',
      features: mergedDrones
        .filter((entry) => toLngLat(entry.position))
        .map((entry) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: toLngLat(entry.position) },
          properties: {
            droneId: entry.droneId,
            code: entry.code,
            battery: entry.batteryLevel,
            heading: entry.heading,
            status: entry.status,
            deliveryId: entry.deliveryId ? String(entry.deliveryId) : null,
            recordedAt: entry.recordedAt || entry.receivedAt || '',
            etaSeconds: entry.etaSeconds ?? null,
            progressPercent: entry.progressPercent ?? null,
            stage: entry.stage || null,
            deliveryStatus: entry.deliveryStatus || entry.status || null,
            speed: entry.speed ?? null,
          },
        })),
    };

    const routesSource = map.getSource('deliveries-routes');
    const pointsSource = map.getSource('deliveries-points');
    const dronesSource = map.getSource('drones-live');

    if (routesSource) routesSource.setData(routes);
    if (pointsSource) pointsSource.setData(points);
    if (dronesSource) dronesSource.setData(drones);

    if (!hasFitRef.current) {
      const coords = [
        ...deliveryGeo.routeFeatures.flatMap((f) => f.geometry.coordinates),
        ...deliveryGeo.pointFeatures.map((f) => f.geometry.coordinates),
      ];
      if (coords.length) {
        const bounds = coords.reduce(
          (b, coord) => b.extend(coord),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
        hasFitRef.current = true;
      }
    }
  }, [deliveryGeo, droneTelemetry, deliveries]);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    const map = mapRef.current;
    const layerId = 'deliveries-routes-highlight';
    if (!map.getLayer(layerId)) return;
    const filter = selectedDeliveryId
      ? ['==', ['coalesce', ['get', 'deliveryId'], '__null__'], String(selectedDeliveryId)]
      : ['==', ['coalesce', ['get', 'deliveryId'], '__null__'], HIGHLIGHT_CLEAR];
    map.setFilter(layerId, filter);
    map.setLayoutProperty(layerId, 'visibility', selectedDeliveryId ? 'visible' : 'none');
  }, [selectedDeliveryId]);

  return (
    <div className="space-y-6">
      {/* Block 1 - Header */}
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-500">
            Delivery Tracking
          </p>
          <h1 className="text-3xl font-semibold text-neutral-900">
            Platform Delivery Tracking
          </h1>
          <p className="text-sm text-neutral-500">
            Monitor real-time drone movement, delivery status, and ETA performance across all hubs.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-neutral-300"
            type="button"
            onClick={loadDeliveries}
          >
            Refresh Live View
          </button>
          <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600">
            Enable Auto Tracking
          </button>
        </div>
      </section>

      {/* Block 2 - Tracking Metrics */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Active Deliveries
          </p>
          <p className="mt-3 text-3xl font-bold text-neutral-900">{trackingMetrics.activeDeliveries}</p>
          <p className="mt-1 text-xs uppercase text-neutral-400">Tracking all routes</p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Average ETA
          </p>
          <p className="mt-3 text-3xl font-bold text-neutral-900">
            {trackingMetrics.avgEtaMinutes} min
          </p>
          <p className="mt-1 text-xs uppercase text-neutral-400">Rolling window</p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Delayed / Alerts
          </p>
          <p className="mt-3 text-3xl font-bold text-neutral-900">{trackingMetrics.delayedAlerts}</p>
          <p className="mt-1 text-xs uppercase text-neutral-400">Failed or cancelled</p>
        </article>
      </section>

      {/* Block 3 - Live Map & Live Deliveries Side by Side */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Live Map (2/3 width) */}
        <section className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-100 pb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                Live Map Overview
              </p>
              <h2 className="text-lg font-semibold text-neutral-900">
                All drones with realtime positions
              </h2>
              <p className="text-sm text-neutral-500">
                Visualize drone position from tracking logs, OSRM polylines for routes, and hub/customer pins.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                4 hubs synced
              </span>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                18 drones online
              </span>
            </div>
          </div>

          {/* Map Container with Layers Button */}
          {mapFullscreen && (
            <div className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-[1px]" aria-hidden="true" />
          )}
          <div
            className={`space-y-6 ${
              mapFullscreen
                ? 'fixed inset-3 z-50 rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl'
                : 'relative mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm'
            }`}
          >
            <div className="absolute top-4 right-4 z-30">
              <button
                onClick={() => setShowMapLayers(!showMapLayers)}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 shadow-md hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span>Layers</span>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMapFullscreen((prev) => !prev)}
              className="absolute top-4 left-4 z-30 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-md hover:bg-neutral-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 9V4h5M4 4l5 5M15 4h5v5M20 4l-5 5M4 15v5h5M4 20l5-5M15 20h5v-5M20 20l-5-5"
                />
              </svg>
              <span>{mapFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}</span>
            </button>

            {showMapLayers && (
              <div className="absolute top-16 right-4 z-30 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                    Map Layers
                  </p>
                  <button
                    onClick={() => setShowMapLayers(false)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <ul className="space-y-2">
                  {mapLegend.map((layer) => (
                    <li
                      key={layer.label}
                      className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50/70 px-3 py-2"
                    >
                      <span className={`mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${layer.indicator}`} />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-neutral-900">{layer.label}</p>
                        <p className="text-xs text-neutral-500">{layer.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              ref={mapContainerRef}
              className="w-full rounded-xl border border-neutral-200"
              style={{ height: mapFullscreen ? 'calc(100vh - 240px)' : '620px' }}
            />

            {!mapFullscreen && (
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold uppercase tracking-wide">
                  Live Drone Stream
                </p>
                {liveDroneStream.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-neutral-100 bg-white/70 p-4 text-xs text-neutral-500">
                    Waiting for in-flight drones... Assign a drone to an order and start telemetry to see live updates.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 text-left text-xs text-neutral-600">
                    {liveDroneStream.map((entry) => {
                      const stageText = formatStageLabel(entry.stage, entry.status);
                      const etaLabel =
                        typeof entry.etaSeconds === 'number' && entry.etaSeconds > 0
                          ? formatEta(entry.etaSeconds)
                          : '--';
                      const progressLabel =
                        typeof entry.progressPercent === 'number'
                          ? `${Math.round(entry.progressPercent)}%`
                          : '--';
                      return (
                        <div
                          key={`${entry.droneId}-${entry.recordedAt}-${entry.receivedAt}`}
                          className="rounded-xl border border-neutral-100 bg-white/90 p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">
                                {entry.code || entry.droneId}
                              </p>
                              <p className="text-[11px] text-neutral-400">
                                Received {new Date(entry.receivedAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${stageBadgeClass(entry.stage)}`}
                            >
                              {stageText}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] md:grid-cols-6">
                            <div>
                              <p className="font-semibold text-neutral-700">Lat</p>
                              <p>{formatCoordinate(entry.position?.lat)}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-700">Lng</p>
                              <p>{formatCoordinate(entry.position?.lng)}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-700">Battery</p>
                              <p>
                                {typeof entry.batteryLevel === 'number' ? `${entry.batteryLevel}%` : '--'}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-700">Delivery</p>
                              <p>{entry.deliveryId ?? '--'}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-700">ETA</p>
                              <p>{etaLabel}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-700">Progress</p>
                              <p>{progressLabel}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-neutral-400">
                            <span>Heading: {entry.heading ?? '--'}</span>
                            <span>Speed: {entry.speed ? `${entry.speed} m/s` : '--'}</span>
                            <span>Recorded: {entry.recordedAt || '--'}</span>
                          </div>
                          {typeof entry.progressPercent === 'number' ? (
                            <div className="mt-3 h-1.5 rounded-full bg-neutral-100">
                              <div
                                className="h-full rounded-full bg-orange-500 transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, entry.progressPercent))}%`,
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right: Live Deliveries Sidebar (1/3 width) */}
        <aside className="lg:col-span-1 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <header className="border-b border-neutral-100 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Live Deliveries
            </p>
            <h2 className="text-lg font-semibold text-neutral-900">
              Active Assignments
            </h2>
            <p className="text-sm text-neutral-500">
              Real-time delivery progress
            </p>
          </header>

          <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
            {loadingDeliveries && (
              <div className="px-6 py-4 text-xs text-neutral-500">Loading deliveries…</div>
            )}
            {!loadingDeliveries && sidebarDeliveries.length === 0 && (
              <div className="px-6 py-4 text-xs text-neutral-500">
                No assigned or in-flight drones yet.
              </div>
            )}
            {sidebarDeliveries.map((delivery) => {
              const battery = delivery.drone?.battery_level ?? null;
              const progress = Number.isFinite(Number(delivery.progress_percent))
                ? Number(delivery.progress_percent)
                : 0;
              const status = delivery.delivery_status || delivery.status;
              const droneCode = delivery.drone?.code || 'Unassigned';
              return (
                <article
                  key={delivery.id}
                  className="px-6 py-4 space-y-3"
                >
                  <div>
                    <p className="text-xs uppercase text-neutral-400">Order #{delivery.order_id || '—'}</p>
                    <h3 className="mt-1 text-sm font-semibold text-neutral-900">
                      {droneCode}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      {delivery.delivery_address?.address || 'In transit'}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-400 uppercase">Status</span>
                      <span className={`font-semibold ${statusColorClass(status)}`}>
                        {status || 'pending'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400 uppercase">Battery</span>
                      <span className="font-semibold text-neutral-900">
                        {typeof battery === 'number' ? `${battery}%` : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400 uppercase">ETA</span>
                      <span className="font-semibold text-neutral-900">
                        {formatEta(delivery.estimated_time_sec)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-400 uppercase">Progress</span>
                      <span className="text-neutral-500">{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-200">
                      <div
                        className="h-2 rounded-full bg-sky-500"
                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleViewRoute(delivery)}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300"
                    >
                      View Route
                    </button>
                    <button className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
                      Logs
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-t border-neutral-100 px-6 py-3">
            <button className="w-full rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
              Export Report
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminDeliveryTracking;
