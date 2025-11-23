import React from 'react';

const maintenanceKpis = [
  { label: 'Needs Maintenance', value: 7, detail: 'Across all hubs' },
  { label: 'Battery Issues', value: 3, detail: 'Below health threshold' },
  { label: 'Firmware Pending', value: 4, detail: 'Awaiting OTA push' },
];

const maintenanceQueue = [
  {
    id: 'DRONE-01',
    model: 'DJI Mavic Air 2',
    status: 'Firmware outdated',
    battery: 62,
    lastMaintenance: '14 days ago',
    nextSchedule: 'In 5 days',
    issueTag: 'Firmware',
  },
  {
    id: 'DRONE-03',
    model: 'DJI Matrice 30',
    status: 'Needs battery check',
    battery: 54,
    lastMaintenance: '28 days ago',
    nextSchedule: 'In 3 days',
    issueTag: 'Battery',
  },
  {
    id: 'DRONE-07',
    model: 'Autel EVO II',
    status: 'Motor vibration detected',
    battery: 81,
    lastMaintenance: '35 days ago',
    nextSchedule: 'Awaiting slot',
    issueTag: 'Motor',
  },
];

const scheduledTasks = [
  {
    id: 'DRONE-05',
    task: 'Firmware Update',
    scheduled: '2025-11-25',
    status: 'Scheduled',
  },
  {
    id: 'DRONE-02',
    task: 'Motor Service',
    scheduled: '2025-11-28',
    status: 'In Progress',
  },
  {
    id: 'DRONE-11',
    task: 'Battery Calibration',
    scheduled: '2025-12-02',
    status: 'Pending',
  },
];

const maintenanceLogs = [
  { type: 'Inspection', detail: 'Motor vibration 12% above normal' },
  { type: 'Battery', detail: 'Cell deviation detected' },
  { type: 'Error', detail: 'GPS module reboot during flight' },
  { type: 'Firmware', detail: 'OTA retry queued after timeout' },
];

const statusBadgeMap = {
  Scheduled: 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-sky-100 text-sky-700',
  Pending: 'bg-amber-100 text-amber-700',
};

const issueBadgeMap = {
  Firmware: 'bg-violet-100 text-violet-700',
  Battery: 'bg-amber-100 text-amber-700',
  Motor: 'bg-rose-100 text-rose-700',
};

const AdminDroneMaintenance = () => {
  return (
    <div className="space-y-6">
      {/* Block 1 - Header */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Drone Maintenance
            </p>
            <h1 className="text-3xl font-semibold text-neutral-900">Service & Health</h1>
            <p className="text-sm text-neutral-500">
              Schedule service, track health issues, and monitor drone lifecycle events.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-neutral-300">
              Add Task
            </button>
            <button className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-neutral-300">
              Export Logs
            </button>
          </div>
        </div>
      </section>

      {/* Block 2 - KPIs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {maintenanceKpis.map((metric) => (
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

      {/* Blocks 3-5 */}
      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* Maintenance List */}
        <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
          <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                Maintenance List
              </p>
              <h2 className="text-lg font-semibold text-neutral-900">Critical drones</h2>
              <p className="text-sm text-neutral-500">
                Focus on drones with degraded batteries, firmware, and hardware incidents.
              </p>
            </div>
            <button className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
              View All Drones
            </button>
          </header>

          <div className="space-y-4">
            {maintenanceQueue.map((drone) => (
              <article
                key={drone.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase text-neutral-400">
                      #{drone.id} — {drone.model}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-neutral-900">{drone.status}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${issueBadgeMap[drone.issueTag] ?? 'bg-neutral-100 text-neutral-600'}`}
                      >
                        {drone.issueTag}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500">Battery: {drone.battery}%</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-neutral-600 md:flex md:flex-wrap md:gap-6">
                    <div>
                      <p className="text-xs uppercase text-neutral-400">Last Maintenance</p>
                      <p className="font-semibold text-neutral-900">{drone.lastMaintenance}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-neutral-400">Next Schedule</p>
                      <p className="font-semibold text-neutral-900">{drone.nextSchedule}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
                    Schedule Maintenance
                  </button>
                  <button className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-300">
                    View Logs
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>

        {/* Right Column */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Scheduled Tasks
            </p>
            <h3 className="mt-1 text-lg font-semibold text-neutral-900">
              Upcoming technician work orders
            </h3>
            <div className="mt-4 space-y-4 divide-y divide-neutral-100">
              {scheduledTasks.map((task, index) => (
                <article key={`${task.id}-${index}`} className="pt-4 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {task.id} — {task.task}
                      </p>
                      <p className="text-xs text-neutral-500">Scheduled: {task.scheduled}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeMap[task.status] ?? 'bg-neutral-100 text-neutral-600'}`}
                    >
                      {task.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Maintenance Logs
            </p>
            <h3 className="mt-1 text-lg font-semibold text-neutral-900">DRONE-03 Logs</h3>
            <div className="mt-4 space-y-3 text-sm">
              {maintenanceLogs.map((log, index) => (
                <div
                  key={`${log.type}-${index}`}
                  className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3"
                >
                  <p className="text-xs uppercase text-neutral-400">{log.type}</p>
                  <p className="text-neutral-800">{log.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default AdminDroneMaintenance;

