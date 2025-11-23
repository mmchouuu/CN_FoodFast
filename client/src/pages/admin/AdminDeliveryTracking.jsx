import React, { useState } from 'react';

const trackingMetrics = [
  { label: 'Active Deliveries', value: 42, detail: 'Tracking all routes' },
  { label: 'Average ETA', value: '11 min', detail: 'Rolling 15 min' },
  { label: 'Delayed Alerts', value: 3, detail: 'Flagged for follow-up' },
];

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
  {
    orderId: 'ORDER #789AF4E',
    droneId: 'DRONE-02',
    status: 'Flying',
    battery: 67,
    progress: 62,
    eta: '6 min',
    pickup: 'District 1 Hub',
    dropoff: '221 Nguyen Thi Minh Khai, District 3',
    route: 'Hub D1 -> Customer #C1029',
  },
  {
    orderId: 'ORDER #7815BBF',
    droneId: 'DRONE-08',
    status: 'Arriving',
    battery: 72,
    progress: 91,
    eta: '2 min',
    pickup: 'Thu Duc Hub',
    dropoff: '12 Street 2, Thu Duc City',
    route: 'Hub TD -> Customer #C876',
  },
  {
    orderId: 'ORDER #7814ECB',
    droneId: 'DRONE-11',
    status: 'Charging',
    battery: 38,
    progress: 0,
    eta: 'Ready in 12 min',
    pickup: 'District 7 Hub',
    dropoff: 'Pending',
    route: 'Pre-flight checks',
  },
];

const statusColorMap = {
  Flying: 'text-sky-600',
  Arriving: 'text-emerald-600',
  Charging: 'text-amber-600',
};

const AdminDeliveryTracking = () => {
  const [showMapLayers, setShowMapLayers] = useState(false);

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
        {trackingMetrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {metric.label}
            </p>
            <p className="mt-3 text-3xl font-bold text-neutral-900">{metric.value}</p>
            <p className="mt-1 text-xs uppercase text-neutral-400">{metric.detail}</p>
          </article>
        ))}
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
          <div className="relative mt-6 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 p-8 text-center text-neutral-400" style={{ minHeight: '600px' }}>
            {/* Map Layers Toggle Button */}
            <button
              onClick={() => setShowMapLayers(!showMapLayers)}
              className="absolute top-4 right-4 z-10 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-md hover:bg-neutral-50"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Layers</span>
              </div>
            </button>

            {/* Map Layers Panel (Collapsible) */}
            {showMapLayers && (
              <div className="absolute top-16 right-4 z-10 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
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
                      <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${layer.indicator}`} />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-neutral-900">{layer.label}</p>
                        <p className="text-xs text-neutral-500">{layer.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Map Placeholder Content */}
            <p className="text-sm font-semibold uppercase tracking-wide">
              Map Placeholder
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-neutral-500">
              Embed your preferred map SDK to draw drone markers from <code>drone_tracking_logs</code>, OSRM route polylines, pickup hubs, and dropoff pins with live ETA overlays.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left text-xs text-neutral-500 md:grid-cols-4">
              <div className="rounded-xl border border-neutral-100 bg-white/70 p-3">
                <p className="font-semibold text-neutral-700">Drone position</p>
                <p className="mt-1 text-[11px] uppercase text-neutral-400">GPS refresh: 1.5s</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-white/70 p-3">
                <p className="font-semibold text-neutral-700">Route polyline</p>
                <p className="mt-1 text-[11px] uppercase text-neutral-400">Source: OSRM</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-white/70 p-3">
                <p className="font-semibold text-neutral-700">Pickup hub</p>
                <p className="mt-1 text-[11px] uppercase text-neutral-400">Hub pin</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-white/70 p-3">
                <p className="font-semibold text-neutral-700">Customer location</p>
                <p className="mt-1 text-[11px] uppercase text-neutral-400">Dropoff pin</p>
              </div>
            </div>
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
            {liveDeliveries.map((delivery) => (
              <article
                key={delivery.orderId}
                className="px-6 py-4 space-y-3"
              >
                <div>
                  <p className="text-xs uppercase text-neutral-400">{delivery.orderId}</p>
                  <h3 className="mt-1 text-sm font-semibold text-neutral-900">
                    {delivery.droneId}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {delivery.route}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 uppercase">Status</span>
                    <span className={`font-semibold ${statusColorMap[delivery.status] ?? 'text-neutral-900'}`}>
                      {delivery.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 uppercase">Battery</span>
                    <span className="font-semibold text-neutral-900">{delivery.battery}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 uppercase">ETA</span>
                    <span className="font-semibold text-neutral-900">{delivery.eta}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400 uppercase">Progress</span>
                    <span className="text-neutral-500">{delivery.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-200">
                    <div
                      className="h-2 rounded-full bg-sky-500"
                      style={{ width: `${delivery.progress}%` }}
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
            ))}
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