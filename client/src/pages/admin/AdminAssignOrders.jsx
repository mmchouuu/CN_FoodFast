import React, { useMemo, useState } from 'react';

const globalMetrics = [
  { label: 'Pending Orders', value: 128 },
  { label: 'Available Drones', value: 76 },
  { label: 'In Flight', value: 32 },
  { label: 'Avg ETA', value: '14 min' },
];

const branches = ['All', 'District 1', 'District 7', 'Thu Duc'];
const hubs = ['District 1 Hub', 'District 7 Hub', 'Thu Duc Hub'];
const sortOptions = ['ETA', 'Battery', 'Workload'];

const mockOrders = [
  {
    id: 'F8A1B9C210',
    items: 2,
    city: 'Springfield',
    placedAgo: '5 min ago',
    eta: '12 minutes',
    preferredTime: '14:45',
    customer: 'Phạm Minh Châu',
    phone: '0798 974 980',
    address: '4/32 TKC, District 1',
    drones: [
      { id: 'Drone-01', label: 'Drone-01 – 95%, 6 min away' },
      { id: 'Drone-02', label: 'Drone-02 – 78%, 12 min away' },
    ],
  },
  {
    id: 'CF7D819AA4',
    items: 3,
    city: 'Thu Duc',
    placedAgo: '12 min ago',
    eta: '18 minutes',
    preferredTime: '15:10',
    customer: 'Nguyễn Quốc An',
    phone: '0903 123 456',
    address: '34 Le Van Viet, Thu Duc',
    drones: [
      { id: 'Drone-05', label: 'Drone-05 – 82%, 10 min away' },
      { id: 'Drone-07', label: 'Drone-07 – 60%, 14 min away' },
    ],
  },
];

const queueByHub = {
  'District 1 Hub': [
    { id: 'Drone 01', distance: '6 min away', battery: '87%', flights: 1, status: 'Ready' },
    { id: 'Drone 02', distance: '12 min away', battery: '54%', flights: 2, status: 'Ready' },
    { id: 'Drone 03', distance: 'Charging', battery: '62%', flights: 0, status: 'Charging' },
    { id: 'Drone 04', distance: 'Ready', battery: '98%', flights: 0, status: 'Ready' },
  ],
  'District 7 Hub': [
    { id: 'Drone 11', distance: '8 min away', battery: '71%', flights: 1, status: 'Ready' },
  ],
  'Thu Duc Hub': [
    { id: 'Drone 21', distance: '5 min away', battery: '64%', flights: 1, status: 'Ready' },
  ],
};

const AdminAssignOrders = () => {
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedHub, setSelectedHub] = useState('District 1 Hub');
  const [sortKey, setSortKey] = useState('ETA');

  const queue = useMemo(() => queueByHub[selectedHub] || [], [selectedHub]);

  return (
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
        </div>

        {/* GLOBAL METRICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {globalMetrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-bold text-neutral-900">{metric.value}</p>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Branch
              <select
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
              >
                {branches.map((branch) => (
                  <option key={branch}>{branch}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Hub
              <select
                value={selectedHub}
                onChange={(event) => setSelectedHub(event.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
              >
                {hubs.map((hub) => (
                  <option key={hub}>{hub}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Sort By
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
              >
                {sortOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            {sortOptions.map((option) => (
              <button
                key={option}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  sortKey === option
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
                onClick={() => setSortKey(option)}
              >
                {option}
              </button>
            ))}
            <button className="ml-auto rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
              Auto-Assign All
            </button>
          </div>
        </div>

        {/* MAIN CONTENT – LEFT ORDERS + RIGHT DRONE QUEUE */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT: ORDER LISTS (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            {mockOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Order #{order.id}</p>
                    <p className="text-sm text-neutral-600">
                      {order.items} items • {order.city} • Placed {order.placedAgo}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-neutral-400">Drone</label>
                    <select className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600">
                      <option value="">Select Drone</option>
                      {order.drones.map((d) => (
                        <option key={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                    <p className="text-xs font-semibold uppercase text-neutral-500">Delivery Window</p>
                    <p className="text-base font-semibold text-neutral-900 mt-2">ETA target: {order.eta}</p>
                    <p className="text-xs text-neutral-500">Preferred time: {order.preferredTime}</p>
                  </div>

                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                    <p className="text-xs font-semibold uppercase text-neutral-500">Customer</p>
                    <p className="text-base font-semibold text-neutral-900 mt-2">{order.customer}</p>
                    <p className="text-sm text-neutral-600">{order.phone}</p>
                    <p className="text-xs text-neutral-500">Address: {order.address}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-neutral-500">
                    Automatically suggest best drones based on battery, proximity, and workload.
                  </p>
                  <div className="flex gap-3">
                    <button className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
                      Preview Flight Route
                    </button>
                    <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
                      Assign Drone
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: DRONE QUEUE SIDEBAR (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                    Drone Queue
                  </p>
                  <p className="text-sm text-neutral-600 mt-1">Hub: {selectedHub}</p>
                </div>
                <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {queue.map((d) => (
                  <div key={d.id} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <p className="font-semibold text-neutral-900">{d.id}</p>
                    <p className="text-xs text-neutral-500 mt-1">{d.distance}</p>
                    <p className="text-xs text-neutral-500">
                      Battery: {d.battery} • Flights: {d.flights}
                    </p>
                    <button className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                      View Flight Logs
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAssignOrders;