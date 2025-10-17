import React from "react";

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const liveDeliveries = [
    {
        id: "DEL-1024",
        shipper: "Tran Thi B",
        status: "In Transit",
        eta: "08 min",
        destination: "21 Nguyen Trai, District 1",
        pathProgress: 65,
    },
    {
        id: "DEL-1025",
        shipper: "Nguyen Van A",
        status: "Picked Up",
        eta: "18 min",
        destination: "85 Vo Van Tan, District 3",
        pathProgress: 35,
    },
];

const DeliveryTracking = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Delivery Tracking</h1>
                    <p className="text-sm text-slate-600">
                        Follow real-time shipper location, delivery status, and estimated arrival times.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
                        Refresh Live View
                    </button>
                    <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                        Enable Auto Tracking
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Delivery Metrics
                    </h2>
                    <ul className="mt-4 space-y-3 text-sm text-slate-600">
                        <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Active Deliveries</span>
                            <span className="font-semibold text-slate-800">7</span>
                        </li>
                        <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Average ETA</span>
                            <span className="font-semibold text-slate-800">16 minutes</span>
                        </li>
                        <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Delayed Alerts</span>
                            <span className="font-semibold text-orange-600">1</span>
                        </li>
                    </ul>
                </div>

                <div className="lg:col-span-2 rounded-xl border border-slate-100 bg-white shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-900">Live Map Overview</h2>
                        <p className="text-sm text-slate-500">
                            Integrate with your preferred map provider to display real shipper positions.
                        </p>
                    </div>
                    <div className="px-6 py-12">
                        <div className="h-64 w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 flex flex-col items-center justify-center text-slate-400">
                            <span className="text-sm font-semibold uppercase tracking-wide">
                                Map Placeholder
                            </span>
                            <p className="text-xs mt-2 text-center max-w-xs">
                                Display a map snapshot with shipper markers and destination pins once connected to your delivery tracking provider.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <header className="px-6 py-4 border-b border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Live Deliveries</h2>
                        <p className="text-sm text-slate-500">
                            Tracking progress and ETA for each active delivery.
                        </p>
                    </div>
                    <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                        Download Report
                    </button>
                </header>
                <div className="divide-y divide-slate-100">
                    {liveDeliveries.map(delivery => (
                        <article key={delivery.id} className="px-6 py-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <div>
                                <p className="text-xs uppercase text-slate-500">Delivery #{delivery.id}</p>
                                <p className="text-base font-semibold text-slate-800 mt-1">{delivery.destination}</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Assigned to {delivery.shipper}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                    Status
                                </span>
                                <p className="mt-2 text-sm font-semibold text-emerald-600">{delivery.status}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Estimated arrival in {delivery.eta}
                                </p>
                            </div>
                            <div className="flex flex-col justify-center gap-2">
                                <div className="h-2 w-full rounded-full bg-slate-200">
                                    <div
                                        className="h-2 rounded-full bg-emerald-500"
                                        style={{ width: `${delivery.pathProgress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 text-right">
                                    {delivery.pathProgress}% route completed
                                </p>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default DeliveryTracking;
