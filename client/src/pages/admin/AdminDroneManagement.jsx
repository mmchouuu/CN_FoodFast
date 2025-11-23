import React, { useMemo, useState } from 'react';

const mockHubs = [
  {
    id: 'hub-d1',
    name: 'District 1 Hub',
    coverage: 'District 1, District 3, Binh Thanh',
    activeDrones: 19,
    inFlight: 5,
    completedToday: 46,
  },
  {
    id: 'hub-d7',
    name: 'District 7 Hub',
    coverage: 'District 7, Nha Be',
    activeDrones: 14,
    inFlight: 4,
    completedToday: 32,
  },
  {
    id: 'hub-td',
    name: 'Thu Duc Hub',
    coverage: 'Thu Duc City, Bien Hoa',
    activeDrones: 22,
    inFlight: 7,
    completedToday: 54,
  },
];

const globalMetrics = [
  { label: 'Total Hubs', value: 5 },
  { label: 'Total Drones', value: 124 },
  { label: 'In Flight', value: 32 },
  { label: 'Needs Maintenance', value: 7 },
];

const availableFilters = [
  { key: 'active', label: 'Active Only' },
  { key: 'charging', label: 'Charging' },
  { key: 'maintenance', label: 'Maintenance' },
];

const mockDrones = [
  {
    id: 'DRONE-01',
    model: 'DJI Mavic Air 2',
    payload: '2.0 kg',
    status: 'Idle',
    battery: 84,
    hub: 'District 1',
    flightsToday: 8,
  },
  {
    id: 'DRONE-02',
    model: 'DJI Mini Pro 3',
    payload: '1.5 kg',
    status: 'In Flight',
    battery: 67,
    hub: 'District 1',
    flightsToday: 6,
  },
  {
    id: 'DRONE-03',
    model: 'DJI Matrice 30T',
    payload: '2.5 kg',
    status: 'Charging',
    battery: 42,
    hub: 'District 1',
    flightsToday: 2,
  },
  {
    id: 'DRONE-04',
    model: 'Autel EVO II',
    payload: '1.5 kg',
    status: 'Maintenance',
    battery: 12,
    hub: 'District 1',
    flightsToday: 0,
  },
];

const sidebarMetrics = [
  { label: 'Avg Battery Level', value: '71%' },
  { label: 'Avg Flight Time', value: '12.4 min' },
  { label: 'Pending Assignments', value: '3 orders' },
  { label: 'Drones in Maintenance', value: '1 unit' },
];

const AdminDroneManagement = () => {
  const [selectedHubId, setSelectedHubId] = useState(mockHubs[0].id);
  const [enabledFilters, setEnabledFilters] = useState(() => new Set());

  const selectedHub = useMemo(
    () => mockHubs.find((hub) => hub.id === selectedHubId) || mockHubs[0],
    [selectedHubId]
  );

  const dronesForHub = useMemo(() => {
    const filters = Array.from(enabledFilters);
    if (!filters.length) return mockDrones;
    return mockDrones.filter((drone) => {
      if (filters.includes('active')) {
        return (
          drone.status?.toLowerCase() === 'idle' ||
          drone.status?.toLowerCase() === 'in flight'
        );
      }
      if (filters.includes('charging')) {
        return drone.status?.toLowerCase() === 'charging';
      }
      if (filters.includes('maintenance')) {
        return drone.status?.toLowerCase() === 'maintenance';
      }
      return true;
    });
  }, [enabledFilters]);

  const toggleFilter = (key) => {
    setEnabledFilters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">System Administration</h1>
              <p className="mt-1 text-sm text-neutral-500">
                System-wide visibility into drone growth, performance, and current incidents.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                Refresh
              </button>
              <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                Export Summary
              </button>
            </div>
          </div>

          {/* Global Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {globalMetrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-500">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-neutral-800">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content: Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Drone List (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-800">Drone List</h2>
                  <p className="text-sm text-neutral-500">Recent drone activity</p>
                </div>
                <button className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                  View All
                </button>
              </div>

              {/* Hub Selection */}
              <div className="mb-4 rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Select Hub
                </label>
                <select
                  value={selectedHubId}
                  onChange={(event) => setSelectedHubId(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50"
                >
                  {mockHubs.map((hub) => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name}
                    </option>
                  ))}
                </select>

                {/* Hub Stats Grid */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">Coverage</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-700">{selectedHub.coverage}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">Active</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-700">{selectedHub.activeDrones}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">In Flight</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-700">{selectedHub.inFlight}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500">Completed</p>
                    <p className="mt-1 text-sm font-semibold text-sky-600">{selectedHub.completedToday}</p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="mb-4 flex flex-wrap gap-2">
                {availableFilters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => toggleFilter(filter.key)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                      enabledFilters.has(filter.key)
                        ? 'border-sky-500 bg-sky-50 text-sky-600'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <button className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
                  Export Hub Data
                </button>
              </div>

              {/* Drone Cards */}
              <div className="space-y-3">
                {dronesForHub.map((drone) => (
                  <div
                    key={drone.id}
                    className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                            {drone.id}
                          </span>
                        </div>
                        <h3 className="mt-1 text-sm font-bold text-neutral-800 truncate">{drone.model}</h3>
                        <p className="mt-0.5 text-xs text-neutral-500 truncate">
                          Max Payload: {drone.payload} | Hub: {drone.hub}
                        </p>
                      </div>

                      <div className="flex gap-6 text-right shrink-0">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Status</p>
                          <p className="mt-0.5 text-sm font-semibold text-neutral-700">{drone.status}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Battery</p>
                          <p className="mt-0.5 text-sm font-semibold text-neutral-700">{drone.battery}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                            Flights Today
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-neutral-700">{drone.flightsToday}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
                      <button className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                        Edit
                      </button>
                      <button className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                        Move to Another Hub
                      </button>
                      <button className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                        View Flight Logs
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Hub Performance (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sticky top-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Hub Performance - Today
                  </h2>
                  <p className="mt-1 text-lg font-bold text-neutral-800">{selectedHub.name}</p>
                  <p className="text-xs text-neutral-500">Service health and uptime across core modules for this hub.</p>
                </div>
              </div>
              
              <button className="mb-4 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                Incident History
              </button>

              <div className="space-y-3">
                {sidebarMetrics.map((metric) => (
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
                    <span className="text-base font-bold text-neutral-800">{selectedHub.activeDrones}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">In Flight</span>
                    <span className="text-base font-bold text-neutral-800">{selectedHub.inFlight}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Completed Today</span>
                    <span className="text-base font-bold text-sky-600">{selectedHub.completedToday}</span>
                  </div>
                </div>
              </div>

              <button className="mt-4 w-full rounded-lg border border-neutral-200 bg-white py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                View Insights
              </button>
            </div>
          </div>
        </div>

        {/* Overview Dashboard Text */}
        <div className="text-center text-sm text-neutral-400">
          <p>Overview Dashboard</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDroneManagement;