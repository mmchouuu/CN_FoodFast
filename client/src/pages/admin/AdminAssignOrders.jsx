import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDroneHubs } from '../../services/adminDroneHubs';
import {
  fetchAssignmentSummary,
  fetchAssignmentHub,
  assignOrderToDrone,
  fetchOrderHubInfo,
} from '../../services/adminAssignments';

const summaryLayout = [
  { label: 'Pending Orders', key: 'pendingOrders' },
  { label: 'Available Drones', key: 'availableDrones' },
  { label: 'In Flight', key: 'inFlight' },
  { label: 'Avg ETA', key: 'avgEtaMinutes', suffix: ' min' },
];

const sortOptions = [
  { label: 'ETA', value: 'eta' },
  { label: 'Battery', value: 'battery' },
  { label: 'Workload', value: 'workload' },
];

const defaultSummary = {
  pendingOrders: 0,
  availableDrones: 0,
  inFlight: 0,
  avgEtaMinutes: 0,
};

const formatRelativeTime = (value) => {
  if (!value) return 'just now';
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return 'just now';
  const diffMinutes = Math.max(Math.round((Date.now() - created) / 60000), 0);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const formatMinutes = (seconds) => {
  if (seconds === null || seconds === undefined) return '—';
  const minutes = Math.max(Math.round(Number(seconds) / 60), 0);
  return `${minutes} min`;
};

const formatDistance = (meters) => {
  if (!meters && meters !== 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const resolveCustomerName = (shipping = {}, fallback) => {
  const candidates = [
    shipping.full_name,
    shipping.fullName,
    shipping.name,
    shipping.recipient,
    shipping.contact_name,
    shipping.contactName,
    shipping.customer_name,
    shipping.customerName,
    fallback,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length) return trimmed;
    }
  }
  return 'Unknown';
};

const resolveCustomerPhone = (shipping = {}, fallback) => {
  const candidates = [
    shipping.phone,
    shipping.phone_number,
    shipping.phoneNumber,
    shipping.contact_phone,
    shipping.contactPhone,
    shipping.recipient_phone,
    shipping.recipientPhone,
    fallback,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length) return trimmed;
    }
  }
  return '—';
};

const resolveCustomerAddress = (shipping = {}) => {
  const prioritized = [
    shipping.street,
    shipping.address,
    shipping.address_line,
    shipping.addressLine,
    shipping.formatted,
  ];
  for (const candidate of prioritized) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length) return trimmed;
    }
  }
  const locality = [shipping.ward, shipping.district, shipping.city]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  if (locality.length) return locality.join(', ');
  return '—';
};

const sanitizeOrderId = (value = '') => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.length) return '';
  return trimmed.replace(/^#+/, '');
};

const AdminAssignOrders = () => {
  const [summary, setSummary] = useState(defaultSummary);
  const [hubs, setHubs] = useState([]);
  const [selectedHubId, setSelectedHubId] = useState('');
  const [sortKey, setSortKey] = useState('eta');
  const [orders, setOrders] = useState([]);
  const [droneQueue, setDroneQueue] = useState([]);
  const [selectedDrones, setSelectedDrones] = useState({});
  const [assigningOrderId, setAssigningOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');
  const queryOrderId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('orderId') || params.get('order_id') || '';
    } catch {
      return '';
    }
  }, []);
  const [orderLookupInput, setOrderLookupInput] = useState(sanitizeOrderId(queryOrderId));
  const [orderLookupLoading, setOrderLookupLoading] = useState(false);
  const [hubSuggestion, setHubSuggestion] = useState(null);
  const [toastNotice, setToastNotice] = useState(null);

  const selectedHub = useMemo(
    () => hubs.find((hub) => hub.id === selectedHubId) || null,
    [hubs, selectedHubId],
  );

  const loadBootstrap = useCallback(async () => {
    setSummaryLoading(true);
    setError('');
    try {
      const [summaryData, hubPayload] = await Promise.all([
        fetchAssignmentSummary(),
        fetchDroneHubs(),
      ]);
      setSummary(summaryData);
      setHubs(hubPayload);
      setSelectedHubId((prev) => prev || hubPayload[0]?.id || '');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load assignment summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadHubAssignments = useCallback(async (hubId, sortValue) => {
    if (!hubId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await fetchAssignmentHub(hubId, { sort: sortValue });
      setOrders(payload.orders || []);
      setDroneQueue(payload.droneQueue || []);
      setSelectedDrones({});
    } catch (err) {
      setOrders([]);
      setDroneQueue([]);
      setError(err?.response?.data?.error || err?.message || 'Failed to load hub assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (selectedHubId) {
      loadHubAssignments(selectedHubId, sortKey);
    }
  }, [selectedHubId, sortKey, loadHubAssignments]);

  const handleSortChange = (nextSort) => {
    setSortKey(nextSort);
  };

  const showToast = useCallback((message, action = null) => {
    if (!message) {
      setToastNotice(null);
      return;
    }
    setToastNotice({
      id: Date.now(),
      message,
      action,
    });
  }, []);

  useEffect(() => {
    if (!toastNotice) return undefined;
    const timer = setTimeout(() => setToastNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [toastNotice]);

  useEffect(() => {
    setOrderLookupInput(sanitizeOrderId(queryOrderId));
  }, [queryOrderId]);

  const handleLocateOrder = useCallback(
    async (orderIdOverride) => {
      const targetOrderId = sanitizeOrderId(orderIdOverride || orderLookupInput || '');
      if (!targetOrderId) {
        showToast('Enter an order ID to locate its hub.');
        return;
      }
      setOrderLookupLoading(true);
      try {
        const result = await fetchOrderHubInfo(targetOrderId);
        setHubSuggestion(result);
        if (!result?.hubId) {
          showToast(`Order #${targetOrderId.slice(0, 8)} has not been assigned to any hub yet.`);
        } else if (result.hubId !== selectedHubId) {
          showToast(`Order #${result.orderId.slice(0, 8)} belongs to ${result.hubName || 'a hub'}.`, {
            label: 'Switch Hub',
            onClick: () => {
              setSelectedHubId(result.hubId);
              setToastNotice(null);
            },
          });
        } else {
          showToast(`Order #${result.orderId.slice(0, 8)} is already under ${selectedHub?.name || 'this hub'}.`);
        }
      } catch (err) {
        setHubSuggestion(null);
        const status = err?.response?.status;
        if (status === 404) {
          showToast(`Could not find order #${targetOrderId.slice(0, 8)}.`);
        } else {
          showToast(err?.response?.data?.error || err?.message || 'Failed to locate order');
        }
      } finally {
        setOrderLookupLoading(false);
      }
    },
    [orderLookupInput, selectedHubId, selectedHub?.name, showToast],
  );

  useEffect(() => {
    if (queryOrderId) {
      handleLocateOrder(queryOrderId);
    }
  }, [queryOrderId, handleLocateOrder]);

  const sortedDroneQueue = useMemo(() => {
    const list = [...droneQueue];
    if (sortKey === 'battery') {
      return list.sort((a, b) => (b.battery_level || 0) - (a.battery_level || 0));
    }
    if (sortKey === 'workload') {
      return list.sort((a, b) => (a.workload || 0) - (b.workload || 0));
    }
    return list;
  }, [droneQueue, sortKey]);

  const droneLookup = useMemo(() => {
    const map = new Map();
    droneQueue.forEach((drone) => {
      if (drone?.id) {
        map.set(drone.id, drone);
      }
    });
    return map;
  }, [droneQueue]);

  const availableDrones = useMemo(
    () =>
      sortedDroneQueue.filter((drone) => ['idle', 'charging'].includes(drone.status || '')),
    [sortedDroneQueue],
  );

  const handleSelectDrone = (orderId, value) => {
    setSelectedDrones((prev) => ({
      ...prev,
      [orderId]: value,
    }));
  };

  const handleAssignDrone = async (entry) => {
    const orderId = entry?.order?.id;
    const deliveryId = entry?.delivery?.id;
    if (!orderId || !deliveryId) {
      setError('Order or delivery information is missing');
      return;
    }
    const droneId = selectedDrones[orderId];
    if (!droneId) {
      setError('Please select a drone for this order');
      return;
    }
    setAssigningOrderId(orderId);
    setError('');
    try {
      await assignOrderToDrone(orderId, { deliveryId, droneId });
      await loadHubAssignments(selectedHubId, sortKey);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to assign drone');
    } finally {
      setAssigningOrderId('');
    }
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* PAGE HEADER */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
            Platform Assignment
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Assign Orders to Drones</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Optimize drone selection and balance workloads across the platform.
          </p>
          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* GLOBAL METRICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryLayout.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {metric.label}
              </p>
              <p className="mt-3 text-3xl font-bold text-neutral-900">
                {metric.key === 'avgEtaMinutes'
                  ? `${summary[metric.key] ?? 0}${metric.suffix || ''}`
                  : summary[metric.key] ?? 0}
              </p>
            </div>
          ))}
        </div>
        {summaryLoading && <p className="text-sm text-neutral-500">Loading platform summary…</p>}

        {/* FILTERS */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Hub
              <select
                value={selectedHubId}
                onChange={(event) => setSelectedHubId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
              >
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Sort By
              <select
                value={sortKey}
                onChange={(event) => handleSortChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  sortKey === option.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
                onClick={() => handleSortChange(option.value)}
              >
                {option.label}
              </button>
            ))}
            <button
              className="ml-auto rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              type="button"
            >
              Auto-Assign All
            </button>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Locate Order by ID
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={orderLookupInput}
                onChange={(event) => setOrderLookupInput(event.target.value)}
                placeholder="e.g. 43741037-c7d8-40b5-8661-f3c19e4be399"
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
              />
              <button
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={orderLookupLoading}
                onClick={() => handleLocateOrder()}
              >
                {orderLookupLoading ? 'Locating…' : 'Locate Order'}
              </button>
            </div>
          </div>
        </div>

        {hubSuggestion?.hubId &&
          hubSuggestion.hubId !== selectedHubId && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Order #{hubSuggestion.orderId.slice(0, 8)} is assigned to{' '}
                    {hubSuggestion.hubName || 'another hub'}.
                  </p>
                  <p className="text-xs text-amber-700">
                    Switch filters to {hubSuggestion.hubName ? `“${hubSuggestion.hubName}”` : 'that hub'} to view and assign drones.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                    type="button"
                    onClick={() => {
                      setSelectedHubId(hubSuggestion.hubId);
                      setHubSuggestion(null);
                      setToastNotice(null);
                    }}
                  >
                    Switch Hub
                  </button>
                  <button
                    className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    type="button"
                    onClick={() => setHubSuggestion(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* MAIN CONTENT */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT: ORDERS */}
          <div className="space-y-4 lg:col-span-2">
            {loading ? (
              <p className="px-6 py-8 text-sm text-neutral-500">Loading hub data…</p>
            ) : orders.length === 0 ? (
              <p className="px-6 py-8 text-sm text-neutral-500">
                No pending orders for {selectedHub?.name || 'this hub'}.
              </p>
            ) : (
              orders.map((entry) => {
                const order = entry.order || {};
                const delivery = entry.delivery || {};
                const etaTargetMinutes =
                  typeof delivery.estimated_time_sec === 'number'
                    ? delivery.estimated_time_sec
                    : null;
                const distanceMeters = delivery.distance_meters ?? null;
                const deliveryId = delivery.id;
                const isAssigned =
                  (delivery && (delivery.delivery_status || delivery.status)) === 'assigned' ||
                  Boolean(delivery?.drone_id);
                const assignedDrone =
                  isAssigned && delivery
                    ? droneLookup.get(delivery.drone_id) ||
                      (delivery.drone_snapshot
                        ? {
                            ...delivery.drone_snapshot,
                            status: delivery.delivery_status || 'assigned',
                          }
                        : {
                            id: delivery.drone_id,
                            code: delivery.drone_code || delivery.droneId || 'Assigned drone',
                            battery_level: delivery.drone_battery_level || null,
                            status: delivery.delivery_status || 'assigned',
                          })
                    : null;

                const shipping =
                  order.shipping_address_snapshot || delivery.delivery_address || {};
                const orderMetadata = order.metadata || {};
                const metadataCustomerName =
                  orderMetadata.customer_name ||
                  orderMetadata.customerName ||
                  orderMetadata.delivery?.contact_name ||
                  orderMetadata.delivery?.contactName ||
                  null;
                const metadataCustomerPhone =
                  orderMetadata.customer_phone ||
                  orderMetadata.customerPhone ||
                  orderMetadata.delivery?.contact_phone ||
                  orderMetadata.delivery?.contactPhone ||
                  null;
                const customerName = resolveCustomerName(shipping, metadataCustomerName);
                const customerPhone = resolveCustomerPhone(shipping, metadataCustomerPhone);
                const customerAddress = resolveCustomerAddress(shipping);

                return (
                <div
                  key={order.id}
                  className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        Order #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {order.item_count || entry.itemCount || 0} items ·{' '}
                        {shipping.city || shipping.district || 'Unknown'} · Placed{' '}
                        {formatRelativeTime(order.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-neutral-400">
                        {isAssigned ? 'Assigned Drone' : 'Drone'}
                      </label>
                      {isAssigned ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          {(assignedDrone && assignedDrone.code) || 'Assigned drone'}
                          {' · '}
                          {assignedDrone && assignedDrone.battery_level !== undefined
                            ? `${assignedDrone.battery_level}%`
                            : '--'}
                        </div>
                      ) : (
                        <select
                          value={selectedDrones[order.id] || ''}
                          onChange={(event) => handleSelectDrone(order.id, event.target.value)}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600"
                        >
                          <option value="">Select Drone</option>
                          {availableDrones.map((drone) => (
                            <option key={drone.id} value={drone.id}>
                              {`${drone.code} · ${drone.battery_level ?? '--'}%`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                      <p className="text-xs font-semibold uppercase text-neutral-500">Delivery Window</p>
                      <p className="mt-2 text-base font-semibold text-neutral-900">
                        ETA target: {formatMinutes(etaTargetMinutes)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Distance: {formatDistance(distanceMeters)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                      <p className="text-xs font-semibold uppercase text-neutral-500">Customer</p>
                      <p className="mt-2 text-base font-semibold text-neutral-900">
                        {customerName}
                      </p>
                      <p className="text-sm text-neutral-600">{customerPhone}</p>
                      <p className="text-xs text-neutral-500">
                        Address: {customerAddress}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs text-neutral-500">
                      {isAssigned
                        ? `Assigned: ${(assignedDrone && assignedDrone.code) || 'Drone'} • Battery ${
                            assignedDrone && assignedDrone.battery_level !== undefined
                              ? `${assignedDrone.battery_level}%`
                              : '--'
                          } • Status ${assignedDrone?.status || delivery?.delivery_status || 'assigned'}`
                        : 'Select a drone that meets payload/battery requirements before dispatching.'}
                    </p>
                    <div className="flex gap-3">
                      {!isAssigned && (
                      <button
                        className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                        type="button"
                        disabled={
                          assigningOrderId === order.id ||
                          !deliveryId ||
                          !selectedDrones[order.id]
                        }
                        onClick={() => handleAssignDrone(entry)}
                      >
                        {assigningOrderId === order.id ? 'Assigning…' : 'Assign Drone'}
                      </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>

          {/* RIGHT: DRONE QUEUE */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                  Drone Queue
                </p>
                <p className="mt-1 text-sm text-neutral-600">Hub: {selectedHub?.name || '—'}</p>
              </div>

              <div className="space-y-3">
                {sortedDroneQueue.map((drone) => (
                  <div key={drone.id} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <p className="font-semibold text-neutral-900">{drone.code}</p>
                    <p className="mt-1 text-xs text-neutral-500 capitalize">{drone.status || 'unknown'}</p>
                    <p className="text-xs text-neutral-500">
                      Battery: {drone.battery_level ?? '--'}% · Flights: {drone.flights_today || 0} · Workload:{' '}
                      {drone.workload || 0}
                    </p>
                    <button className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700" type="button">
                      View Flight Logs
                    </button>
                  </div>
                ))}
                {!droneQueue.length && !loading && (
                  <p className="text-xs text-neutral-500">No drones available for this hub.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="flex gap-3 p-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-neutral-900">Notification</p>
              <p className="mt-1 text-xs text-neutral-600">{toastNotice.message}</p>
              {toastNotice.action && (
                <button
                  className="mt-3 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                  type="button"
                  onClick={() => {
                    toastNotice.action.onClick?.();
                  }}
                >
                  {toastNotice.action.label}
                </button>
              )}
            </div>
            <button
              className="text-neutral-400 hover:text-neutral-600"
              type="button"
              onClick={() => setToastNotice(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminAssignOrders;
