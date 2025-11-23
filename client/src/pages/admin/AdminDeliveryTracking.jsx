import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import api from '../../services/api';

const mapLegend = [
  {
    label: 'Drone Positions',
    description: 'Live from drone_tracking_logs',
    indicator: 'bg-sky-500',
  },
  {
    label: 'Route Polylines',
    description: 'OSRM optimized routes',
    indicator: 'bg-emerald-500',
  },
  {
    label: 'Hub Location',
    description: 'Origin hub pin',
    indicator: 'bg-indigo-500',
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

const SOCKET_GATEWAY_URL = import.meta.env.VITE_SOCKET_GATEWAY_URL || 'http://localhost:4000';
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || '';
const CUSTOM_MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || '';
const MAP_STYLE =
  CUSTOM_MAP_STYLE ||
  (MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${MAPTILER_KEY}`
    : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json');
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

const buildDeliveryFeatures = (deliveries = []) => {
  const routeFeatures = [];
  const pointFeatures = [];

  deliveries.forEach((delivery) => {
    const deliveryIdRaw = delivery.id || delivery.order_id || `delivery-${Math.random()}`;
    const deliveryId = deliveryIdRaw ? String(deliveryIdRaw) : null;

    const hubCoord = toLngLat(delivery?.drone?.hub?.location);
    const shopCoord = toLngLat(delivery?.branch_location);
    let routeCoords = extractRouteCoordinates(delivery?.route);
    const customerCoord = resolveCustomerCoordinate(delivery, routeCoords);

    if (routeCoords.length < 2) {
      const currentCoord = toLngLat(delivery?.current_position);
      const droneCoord = toLngLat(delivery?.drone?.last_known_position);
      const startCoord = shopCoord || hubCoord || currentCoord || droneCoord || null;
      const endCoord = customerCoord || currentCoord || null;
      if (
        startCoord &&
        endCoord &&
        (startCoord[0] !== endCoord[0] || startCoord[1] !== endCoord[1])
      ) {
        routeCoords = [startCoord, endCoord];
      }
    }

    if (routeCoords.length >= 2) {
      routeFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeCoords,
        },
        properties: {
          deliveryId,
          status: delivery.delivery_status || delivery.status || 'active',
        },
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
    pushPoint(shopCoord, 'shop', 'Restaurant / Hub');
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
  const position = delivery.current_position || delivery.drone.last_known_position;
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
    () => buildDeliveryFeatures(deliveries),
    [deliveries],
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
          'line-color': '#10b981',
          'line-width': 4,
          'line-opacity': 0.95,
          'line-blur': 0.2,
        },
        layout: {
          visibility: 'none',
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
            'shop',
            '#0ea5e9',
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
            'shop',
            'S',
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
          'line-color': '#f97316',
          'line-width': 6,
          'line-opacity': 0.9,
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
          'circle-radius': 8,
          'circle-color': '#0f172a',
          'circle-stroke-color': '#e2e8f0',
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
            <div class="text-xs text-neutral-500">Battery: ${battery}</div>
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
        return {
          ...entry,
          position: mergedPosition,
          deliveryId: mergedDeliveryId,
          recordedAt: mergedRecordedAt,
          status: mergedStatus,
          batteryLevel: mergedBattery,
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
          <button className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-neutral-300">
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
                {droneTelemetry.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-neutral-100 bg-white/70 p-4 text-xs text-neutral-500">
                    Waiting for telemetry... Use the new telemetry API to push coordinates and this feed will update in real-time.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 text-left text-xs text-neutral-600">
                    {droneTelemetry.map((entry) => (
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
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold uppercase text-sky-700">
                            {entry.status || 'unknown'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] md:grid-cols-4">
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
                            <p>{typeof entry.batteryLevel === 'number' ? `${entry.batteryLevel}%` : '--'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-700">Speed</p>
                            <p>{entry.speed ? `${entry.speed} m/s` : '--'}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-neutral-400">
                          <span>Heading: {entry.heading ?? '--'}</span>
                          <span>Delivery: {entry.deliveryId ?? '--'}</span>
                          <span>Recorded: {entry.recordedAt || '--'}</span>
                        </div>
                      </div>
                    ))}
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
            {!loadingDeliveries && deliveries.length === 0 && (
              <div className="px-6 py-4 text-xs text-neutral-500">No active deliveries yet.</div>
            )}
            {deliveries.map((delivery) => {
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
                    <button className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
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
