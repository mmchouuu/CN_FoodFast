import React, { useMemo } from "react";
import { dummyDashboardData, dummyOrdersData } from "../../assets/data";
import { useAppContext } from "../../context/AppContext";

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const Dashboard = () => {
    const { currency } = useAppContext();

    const metrics = useMemo(() => {
        const pendingOrders = dummyOrdersData.filter(order =>
            ["Order Placed", "Packing", "Shipping", "Out for delivery"].includes(order.status)
        );

        const revenueToday = dummyOrdersData
            .filter(order => order.status !== "Canceled")
            .reduce((sum, order) => sum + order.amount, 0);

        return {
            totalOrders: dummyDashboardData.totalOrders,
            pendingCount: pendingOrders.length,
            revenueToday,
            avgTicket: dummyOrdersData.length
                ? revenueToday / dummyOrdersData.length
                : 0,
        };
    }, []);

    const quickActions = [
        { label: "Create New Dish", description: "Add a menu item", action: "Add Dish" },
        { label: "Assign Pending Orders", description: "Dispatch to shipper", action: "Assign" },
        { label: "Create Promotion", description: "Launch flash sale", action: "New Promo" },
        { label: "View Feedback", description: "Respond to customers", action: "Open Inbox" },
    ];

    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Restaurant Dashboard</h1>
                    <p className="text-sm text-slate-600">
                        Overview of today&apos;s performance, revenue, and operational status.
                    </p>
                </div>
                <div className="text-sm text-slate-500">
                    {new Date().toLocaleString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                    })}
                </div>
            </header>

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <SummaryCard
                    title="Today's Revenue"
                    value={`${currency}${metrics.revenueToday.toFixed(2)}`}
                    trend="+12.5% vs yesterday"
                    accent="bg-emerald-100 text-emerald-700"
                />
                <SummaryCard
                    title="Orders Today"
                    value={metrics.totalOrders.toString().padStart(2, "0")}
                    trend="+8 new orders"
                    accent="bg-blue-100 text-blue-700"
                />
                <SummaryCard
                    title="Pending Orders"
                    value={metrics.pendingCount.toString().padStart(2, "0")}
                    trend="4 awaiting confirmation"
                    accent="bg-orange-100 text-orange-700"
                />
                <SummaryCard
                    title="Average Ticket"
                    value={`${currency}${metrics.avgTicket.toFixed(2)}`}
                    trend="Includes dine-in & delivery"
                    accent="bg-purple-100 text-purple-700"
                />
            </section>

            <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="border-b border-slate-100 px-6 py-4">
                        <h2 className="text-lg font-semibold text-slate-900">Live Orders</h2>
                        <p className="text-sm text-slate-500">
                            Track preparation progress and dispatch status in real-time.
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {dummyOrdersData.map(order => (
                            <article key={order._id} className="px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm uppercase text-slate-500">Order #{order._id.slice(-6)}</p>
                                    <p className="text-base font-semibold text-slate-800">
                                        {order.address.firstName} {order.address.lastName}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {order.items.length} items · {order.paymentMethod} ·{" "}
                                        {order.isPaid ? "Paid" : "Awaiting payment"}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 md:items-end">
                                    <span className="text-sm font-medium text-slate-700">
                                        {currency}{order.amount.toFixed(2)}
                                    </span>
                                    <StatusPill status={order.status} />
                                </div>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
                    <div className="border-b border-slate-100 px-6 py-4">
                        <h2 className="text-lg font-semibold text-slate-900">Operational Summary</h2>
                        <p className="text-sm text-slate-500">
                            Highlights for quick actions.
                        </p>
                    </div>
                    <div className="px-6 py-4 space-y-4 flex-1">
                        {quickActions.map(action => (
                            <div key={action.label} className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-start justify-between gap-4">
                                <div>
                                    <p className="font-semibold text-slate-800">{action.label}</p>
                                    <p className="text-xs text-slate-500">{action.description}</p>
                                </div>
                                <button type="button" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                                    {action.action}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mt-8 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Kitchen Queue</h2>
                        <p className="text-sm text-slate-500">Orders in preparation with elapsed time.</p>
                    </div>
                    <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition"
                    >
                        Update Prep Times
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-slate-500 uppercase">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-3">Dish</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Prep Status</th>
                                <th className="px-6 py-3">Elapsed</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {["Signature Pho", "Lemongrass Chicken", "Vegan Spring Rolls", "Mango Smoothie"].map((dish, index) => (
                                <tr key={dish} className="border-b border-slate-100 last:border-b-0">
                                    <td className="px-6 py-3 font-medium text-slate-800">{dish}</td>
                                    <td className="px-6 py-3 text-slate-500">
                                        {["Main Course", "Main Course", "Appetizer", "Beverage"][index]}
                                    </td>
                                    <td className="px-6 py-3">
                                        <StatusPill
                                            status={["Cooking", "Queued", "Plating", "Ready"][index]}
                                        />
                                    </td>
                                    <td className="px-6 py-3 text-slate-500">
                                        {["08 min", "02 min", "14 min", "1 min"][index]}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                                            Notify Shipper
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

const SummaryCard = ({ title, value, trend, accent }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col gap-2">
        <p className="text-sm text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <span className={`inline-flex text-xs font-semibold px-3 py-1 rounded-full ${accent}`}>
            {trend}
        </span>
    </div>
);

const statusColors = {
    "Order Placed": "bg-slate-100 text-slate-600",
    Packing: "bg-yellow-100 text-yellow-700",
    Shipping: "bg-blue-100 text-blue-700",
    "Out for delivery": "bg-emerald-100 text-emerald-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Canceled: "bg-red-100 text-red-700",
    Cooking: "bg-orange-100 text-orange-700",
    Queued: "bg-slate-100 text-slate-600",
    Plating: "bg-purple-100 text-purple-700",
    Ready: "bg-emerald-100 text-emerald-700",
};

const StatusPill = ({ status }) => (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || "bg-slate-100 text-slate-600"}`}>
        {status}
    </span>
);

export default Dashboard;
