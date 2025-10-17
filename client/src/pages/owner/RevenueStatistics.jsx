import React, { useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { useAppContext } from "../../context/AppContext";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
);

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthlyRevenue = [32000000, 28500000, 35400000, 36800000, 40200000, 41800000, 45000000, 43700000, 46200000, 49800000, 47200000, 52500000];
const monthlyOrders = [820, 760, 890, 930, 980, 1020, 1095, 1060, 1125, 1200, 1175, 1260];
const topDishes = [
    { name: "Pho Special", revenue: 12500000, growth: "+12%" },
    { name: "Crispy Pork Banh Mi", revenue: 9800000, growth: "+8%" },
    { name: "Lemongrass Chicken", revenue: 8600000, growth: "+5%" },
];

const RevenueStatistics = () => {
    const { currency } = useAppContext();

    const revenueDataset = useMemo(
        () => ({
            labels: monthLabels,
            datasets: [
                {
                    label: "Revenue",
                    data: monthlyRevenue,
                    backgroundColor: "rgba(16, 185, 129, 0.8)",
                    borderRadius: 6,
                    barThickness: 32,
                },
            ],
        }),
        [],
    );

    const orderDataset = useMemo(
        () => ({
            labels: monthLabels,
            datasets: [
                {
                    label: "Orders",
                    data: monthlyOrders,
                    borderColor: "rgba(59, 130, 246, 0.9)",
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.25,
                    fill: false,
                },
            ],
        }),
        [],
    );

    const revenueOptions = useMemo(
        () => ({
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: "Monthly Revenue (VND)" },
                tooltip: {
                    callbacks: {
                        label: context => `${currency}${context.parsed.y.toLocaleString()}`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `${currency}${Number(value).toLocaleString()}`,
                    },
                },
            },
        }),
        [currency],
    );

    const orderOptions = useMemo(
        () => ({
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: "Orders per Month" },
            },
            scales: { y: { beginAtZero: true } },
        }),
        [],
    );

    const totalRevenue = monthlyRevenue.reduce((sum, value) => sum + value, 0);
    const avgRevenue = totalRevenue / monthLabels.length;

    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Revenue Statistics</h1>
                    <p className="text-sm text-slate-600">
                        Analyze revenue trends, order growth, and top performing dishes by period.
                    </p>
                </div>
                <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                    Download Finance Report
                </button>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Revenue (YTD)" value={`${currency}${totalRevenue.toLocaleString()}`} subtitle="Based on completed orders" />
                <StatCard label="Average Monthly Revenue" value={`${currency}${Math.round(avgRevenue).toLocaleString()}`} subtitle="Rolling 12-month average" />
                <StatCard label="Best Month" value="December" subtitle={`${currency}${monthlyRevenue[11].toLocaleString()} revenue`} />
                <StatCard label="Highest Daily Sales" value={`${currency}2,850,000`} subtitle="Recorded Apr 11th" />
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                    <Bar data={revenueDataset} options={revenueOptions} />
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                    <Line data={orderDataset} options={orderOptions} />
                </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Revenue Breakdown</h2>
                    <ul className="space-y-3 text-sm text-slate-600">
                        <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Delivery vs Dine-in</span>
                            <span className="font-semibold text-emerald-600">64% / 36%</span>
                        </li>
                        <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Peak Revenue Day</span>
                            <span className="font-semibold text-slate-800">Friday</span>
                        </li>
                        <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Average Order Value</span>
                            <span className="font-semibold text-slate-800">{currency}185,000</span>
                        </li>
                    </ul>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Top Performing Dishes</h2>
                    <ul className="space-y-3 text-sm text-slate-600">
                        {topDishes.map(dish => (
                            <li key={dish.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div>
                                    <p className="font-semibold text-slate-800">{dish.name}</p>
                                    <p className="text-xs text-slate-500">Growth {dish.growth}</p>
                                </div>
                                <span className="text-sm font-semibold text-emerald-600">
                                    {currency}{dish.revenue.toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </div>
    );
};

const StatCard = ({ label, value, subtitle }) => (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
    </div>
);

export default RevenueStatistics;
