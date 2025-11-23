import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAdminDrone,
  deleteAdminDrone,
  fetchAdminDroneLogs,
  fetchAdminDrones,
  fetchDroneHubs,
  fetchDroneSystemSummary,
  fetchHubOverview,
  updateAdminDrone,
} from '../../services/adminDroneHubs';

const availableFilters = [
  { key: 'active', label: 'Active Only' },
  { key: 'charging', label: 'Charging' },
  { key: 'maintenance', label: 'Maintenance' },
];

const summaryLayout = [
  { label: 'Total Hubs', key: 'totalHubs' },
  { label: 'Total Drones', key: 'totalDrones' },
  { label: 'In Flight', key: 'inFlight' },
  { label: 'Needs Maintenance', key: 'needsMaintenance' },
];

const statusOptions = [
  { value: 'idle', label: 'Idle' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'flying', label: 'In Flight' },
  { value: 'charging', label: 'Charging' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'offline', label: 'Offline' },
];

const defaultSummary = {
  totalHubs: 0,
  totalDrones: 0,
  inFlight: 0,
  needsMaintenance: 0,
};

const defaultHubStats = {
  coverage: '—',
  active: 0,
  inFlight: 0,
  completedToday: 0,
};

const defaultPerformance = {
  avgBatteryLevel: 0,
  avgFlightTimeMinutes: 0,
  pendingAssignments: 0,
  maintenanceCount: 0,
};

const emptyFormValues = {
  id: '',
  hubId: '',
  code: '',
  model: '',
  maxPayload: '',
  batteryLevel: '',
  status: 'idle',
  imageUrl: '',
};

const AdminDroneManagement = () => {
  const [systemSummary, setSystemSummary] = useState(defaultSummary);
  const [hubs, setHubs] = useState([]);
  const [selectedHubId, setSelectedHubId] = useState('');
  const [hubOverview, setHubOverview] = useState(defaultHubStats);
  const [performance, setPerformance] = useState(defaultPerformance);
  const [drones, setDrones] = useState([]);
  const [activeFilter, setActiveFilter] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [hubLoading, setHubLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [formState, setFormState] = useState({
    open: false,
    mode: 'create',
    saving: false,
    error: '',
    values: { ...emptyFormValues },
  });
  const [logsState, setLogsState] = useState({
    open: false,
    loading: false,
    drone: null,
    items: [],
    error: '',
  });

  const selectedHub = useMemo(
    () => hubs.find((hub) => hub.id === selectedHubId) || null,
    [hubs, selectedHubId],
  );

  const performanceMetrics = useMemo(
    () => [
      {
        label: 'Avg Battery Level',
        value: performance.avgBatteryLevel
          ? `${Math.round(performance.avgBatteryLevel)}%`
          : '0%',
      },
      {
        label: 'Avg Flight Time',
        value: performance.avgFlightTimeMinutes
          ? `${performance.avgFlightTimeMinutes.toFixed(1)} min`
          : '0 min',
      },
      {
        label: 'Pending Assignments',
        value: `${performance.pendingAssignments || 0} orders`,
      },
      {
        label: 'Drones in Maintenance',
        value: `${performance.maintenanceCount || 0} unit${
          performance.maintenanceCount === 1 ? '' : 's'
        }`,
      },
    ],
    [performance],
  );

  const loadBootstrap = useCallback(async () => {
    setPageLoading(true);
    setError('');
    try {
      const [summaryPayload, hubsPayload] = await Promise.all([
        fetchDroneSystemSummary(),
        fetchDroneHubs(),
      ]);
      setSystemSummary(summaryPayload);
      setHubs(hubsPayload);
      setSelectedHubId((current) => {
        if (current && hubsPayload.some((hub) => hub.id === current)) {
          return current;
        }
        return hubsPayload[0]?.id || '';
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load system data');
    } finally {
      setPageLoading(false);
    }
  }, []);

  const loadHubDetails = useCallback(async (hubId, statusFilter) => {
    if (!hubId) return;
    setHubLoading(true);
    setError('');
    try {
      const [overviewPayload, droneRows] = await Promise.all([
        fetchHubOverview(hubId),
        fetchAdminDrones({
          hubId,
          status: statusFilter || undefined,
        }),
      ]);
      setHubOverview(overviewPayload?.overview || defaultHubStats);
      setPerformance(overviewPayload?.performance || defaultPerformance);
      const items = Array.isArray(droneRows?.data) ? droneRows.data : droneRows;
      setDrones(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load hub data');
    } finally {
      setHubLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (selectedHubId) {
      loadHubDetails(selectedHubId, activeFilter);
    }
  }, [selectedHubId, activeFilter, loadHubDetails]);

  const handleFilterToggle = (key) => {
    setActiveFilter((prev) => (prev === key ? '' : key));
  };

  const handleRefresh = () => {
    loadBootstrap();
    if (selectedHubId) {
      loadHubDetails(selectedHubId, activeFilter);
    }
  };

  const openForm = (mode, drone = null) => {
    setFormState({
      open: true,
      mode,
      saving: false,
      error: '',
      values: {
        id: drone?.id || '',
        hubId: drone?.hub_id || selectedHubId || '',
        code: drone?.code || '',
        model: drone?.model || '',
        maxPayload:
          drone?.max_payload !== null && drone?.max_payload !== undefined
            ? String(drone.max_payload)
            : '',
        batteryLevel:
          drone?.battery_level !== null && drone?.battery_level !== undefined
            ? String(drone.battery_level)
            : '',
        status: drone?.status || 'idle',
        imageUrl: drone?.image_url || '',
      },
    });
  };

  const closeForm = () => {
    setFormState((prev) => ({
      ...prev,
      open: false,
      saving: false,
      error: '',
      values: { ...emptyFormValues, hubId: selectedHubId || '' },
    }));
  };

  const handleFormChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value },
    }));
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      hub_id: formState.values.hubId || selectedHubId || null,
      code: formState.values.code?.trim(),
      model: formState.values.model?.trim(),
      max_payload: formState.values.maxPayload
        ? Number(formState.values.maxPayload)
        : null,
      battery_level: formState.values.batteryLevel
        ? Number(formState.values.batteryLevel)
        : undefined,
      status: formState.values.status,
      image_url: formState.values.imageUrl?.trim() || null,
    };

    if (!payload.code || !payload.model) {
      setFormState((prev) => ({
        ...prev,
        error: 'Drone code and model are required.',
      }));
      return;
    }

    setFormState((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      if (formState.mode === 'edit' && formState.values.id) {
        await updateAdminDrone(formState.values.id, payload);
      } else {
        await createAdminDrone(payload);
      }
      closeForm();
      await loadHubDetails(payload.hub_id || selectedHubId, activeFilter);
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        saving: false,
        error: err?.response?.data?.error || err?.message || 'Failed to save drone',
      }));
    }
  };

  const handleDeleteDrone = async (drone) => {
    if (!drone?.id) return;
    const confirm = window.confirm(
      `Remove ${drone.code || 'this drone'} from the fleet?`,
    );
    if (!confirm) return;
    setDeletingId(drone.id);
    setError('');
    try {
      await deleteAdminDrone(drone.id);
      await loadHubDetails(selectedHubId, activeFilter);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to remove drone');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewLogs = async (drone) => {
    if (!drone?.id) return;
    setLogsState({ open: true, loading: true, drone, items: [], error: '' });
    try {
      const items = await fetchAdminDroneLogs(drone.id);
      setLogsState({ open: true, loading: false, drone, items, error: '' });
    } catch (err) {
      setLogsState({
        open: true,
        loading: false,
        drone,
        items: [],
        error: err?.response?.data?.error || err?.message || 'Failed to load flight logs',
      });
    }
  };

  const closeLogs = () => {
    setLogsState({ open: false, loading: false, drone: null, items: [], error: '' });
  };

  const hubCoverage = hubOverview.coverage || selectedHub?.coverage || selectedHub?.address || '—';

  const formatPayload = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    return `${parsed.toFixed(1)} kg`;
  };

  const formatBattery = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '—';
    }
    return `${Number(value)}%`;
  };

  const formatStatus = (value) => {
    if (!value) return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">System Administration</h1>
              <p className="mt-1 text-sm text-neutral-500">
                System-wide visibility into drone growth, performance, and current incidents.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                onClick={handleRefresh}
              >
                Refresh
              </button>
              <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                Export Summary
              </button>
            </div>
          </div>
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {summaryLayout.map((metric) => (
              <div key={metric.key} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-500">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-neutral-800">
                  {systemSummary[metric.key] ?? 0}
                </p>
              </div>
            ))}
          </div>
          {pageLoading && (
            <p className="mt-4 text-sm text-neutral-500">Loading system data...</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-neutral-800">Drone List</h2>
                  <p className="text-sm text-neutral-500">Recent drone activity</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                    onClick={() => setActiveFilter('')}
                  >
                    View All
                  </button>
                  <button
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
                    onClick={() => openForm('create')}
                  >
                    Add new drone
                  </button>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Select Hub
                </label>
                <select
                  value={selectedHubId}
                  onChange={(event) => setSelectedHubId(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                >
                  {hubs.map((hub) => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name}
                    </option>
                  ))}
                </select>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">Coverage</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-700">{hubCoverage}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">Active</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-700">{hubOverview.active}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">In Flight</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-700">{hubOverview.inFlight}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">Completed</p>
                    <p className="mt-1 text-sm font-semibold text-sky-600">
                      {hubOverview.completedToday}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {availableFilters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => handleFilterToggle(filter.key)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                      activeFilter === filter.key
                        ? 'border-sky-500 bg-sky-50 text-sky-600'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {hubLoading ? (
                <p className="px-4 py-6 text-sm text-neutral-500">Loading hub data...</p>
              ) : drones.length === 0 ? (
                <p className="px-4 py-6 text-sm text-neutral-500">No drones registered for this hub.</p>
              ) : (
                <div className="space-y-3">
                  {drones.map((drone) => (
                    <div
                      key={drone.id}
                      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4">
                          {drone.image_url ? (
                            <img
                              src={drone.image_url}
                              alt={drone.model || drone.code}
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-neutral-100 text-sm font-semibold text-neutral-500">
                              {drone.code?.slice(0, 2) || 'DR'}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                              {drone.code}
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-neutral-900">{drone.model || 'Unnamed drone'}</h3>
                            <p className="mt-0.5 text-sm text-neutral-500">
                              Max Payload: {formatPayload(drone.max_payload)} | Hub:{' '}
                              {drone.hub_name || '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-6 text-right">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Status</p>
                            <p className="mt-0.5 text-sm font-semibold text-neutral-700">
                              {formatStatus(drone.status)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Battery</p>
                            <p className="mt-0.5 text-sm font-semibold text-neutral-700">
                              {formatBattery(drone.battery_level)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                              Flights Today
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-neutral-700">
                              {drone.flights_today || 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                        <button
                          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                          onClick={() => openForm('edit', drone)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                          onClick={() => openForm('edit', drone)}
                        >
                          Move to Another Hub
                        </button>
                        <button
                          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                          onClick={() => handleViewLogs(drone)}
                        >
                          View Flight Logs
                        </button>
                        <button
                          className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          onClick={() => handleDeleteDrone(drone)}
                          disabled={deletingId === drone.id}
                        >
                          {deletingId === drone.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Hub Performance - Today
                </h2>
                <p className="mt-1 text-lg font-bold text-neutral-800">
                  {selectedHub?.name || 'Select a hub'}
                </p>
                <p className="text-xs text-neutral-500">
                  Service health and uptime across core modules for this hub.
                </p>
              </div>

              <button className="mb-4 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                Incident History
              </button>

              <div className="space-y-3">
                {performanceMetrics.map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <span className="text-sm text-neutral-600">{metric.label}</span>
                    <span className="text-sm font-semibold text-neutral-800">{metric.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg bg-neutral-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Today Stats</h3>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Active Drones</span>
                    <span className="text-base font-bold text-neutral-800">{hubOverview.active}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">In Flight</span>
                    <span className="text-base font-bold text-neutral-800">{hubOverview.inFlight}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Completed Today</span>
                    <span className="text-base font-bold text-sky-600">{hubOverview.completedToday}</span>
                  </div>
                </div>
              </div>

              <button className="mt-4 w-full rounded-lg border border-neutral-200 bg-white py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                View Insights
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-neutral-400">
          <p>Overview Dashboard</p>
        </div>
      </div>

      {formState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleFormSubmit}
            className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {formState.mode === 'edit' ? 'Update drone' : 'Register a drone'}
                </p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {formState.mode === 'edit' ? 'Edit drone' : 'Add new drone'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            {formState.error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                {formState.error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-neutral-600">
                Hub
                <select
                  value={formState.values.hubId}
                  onChange={(event) => handleFormChange('hubId', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                >
                  <option value="" disabled>
                    Select hub
                  </option>
                  {hubs.map((hub) => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-neutral-600">
                Drone Code
                <input
                  type="text"
                  value={formState.values.code}
                  onChange={(event) => handleFormChange('code', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                />
              </label>
              <label className="text-sm font-medium text-neutral-600">
                Model
                <input
                  type="text"
                  value={formState.values.model}
                  onChange={(event) => handleFormChange('model', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                />
              </label>
              <label className="text-sm font-medium text-neutral-600">
                Status
                <select
                  value={formState.values.status}
                  onChange={(event) => handleFormChange('status', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-neutral-600">
                Max Payload (kg)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formState.values.maxPayload}
                  onChange={(event) => handleFormChange('maxPayload', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                />
              </label>
              <label className="text-sm font-medium text-neutral-600">
                Battery Level (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formState.values.batteryLevel}
                  onChange={(event) => handleFormChange('batteryLevel', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                />
              </label>
            </div>

            <label className="text-sm font-medium text-neutral-600 block">
              Image URL
              <input
                type="url"
                value={formState.values.imageUrl}
                onChange={(event) => handleFormChange('imageUrl', event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50"
                disabled={formState.saving}
              >
                {formState.saving ? 'Saving...' : 'Save drone'}
              </button>
            </div>
          </form>
        </div>
      )}

      {logsState.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Flight Logs
                </p>
                <h3 className="text-2xl font-bold text-neutral-900">
                  {logsState.drone?.code || 'Drone'}
                </h3>
              </div>
              <button
                onClick={closeLogs}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            {logsState.loading ? (
              <p className="text-sm text-neutral-500">Loading logs...</p>
            ) : logsState.error ? (
              <p className="text-sm text-rose-600">{logsState.error}</p>
            ) : logsState.items.length === 0 ? (
              <p className="text-sm text-neutral-500">No logs recorded for this drone.</p>
            ) : (
              <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
                {logsState.items.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                      <span className="text-neutral-500">
                        Battery {formatBattery(log.battery_level)} • Speed {log.speed || 0} m/s
                      </span>
                    </div>
                    {log.position && (
                      <p className="mt-1 text-neutral-500 text-xs">
                        Position: {JSON.stringify(log.position)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDroneManagement;
