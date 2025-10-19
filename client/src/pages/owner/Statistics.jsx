// import React from 'react'

// const Statistics = () => {
//   return (
//     <div>Statistics</div>
//   )
// }

// export default Statistics

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
  Legend
);

const Statistics = () => {
  const { currency } = useAppContext();

  // Dummy revenue data (12 months)
  const revenueLabels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const revenueData = [1200, 2100, 1800, 2400, 3200, 2800, 3400, 3000, 3600, 4200, 3900, 4800];

  // Dummy users growth (cumulative)
  const userLabels = revenueLabels;
  const userGrowth = [50, 75, 120, 150, 200, 260, 320, 400, 480, 560, 640, 720];

  const barOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Monthly Revenue" },
      tooltip: {
        callbacks: {
          label: (ctx) => `${currency || "$"}${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }), [currency]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "User Growth (Cumulative)" },
    },
    scales: {
      y: { beginAtZero: true },
    },
  }), []);

  const barDataset = {
    labels: revenueLabels,
    datasets: [
      {
        label: "Revenue",
        data: revenueData,
        backgroundColor: "rgba(59,130,246,0.8)",
        borderRadius: 6,
        barThickness: 28,
      },
    ],
  };

  const lineDataset = {
    labels: userLabels,
    datasets: [
      {
        label: "Users",
        data: userGrowth,
        fill: false,
        tension: 0.25,
        borderWidth: 2,
        borderColor: "rgba(34,197,94,0.9)",
        pointRadius: 3,
      },
    ],
  };

  // Top-level stats (simple)
  const totalUsers = userGrowth[userGrowth.length - 1];
  const totalRevenue = revenueData.reduce((a, b) => a + b, 0);

  return (
    <div className="md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-[#fff4d2] rounded-xl flex flex-col gap-2">
          <h3 className="text-2xl font-bold">{totalUsers}</h3>
          <p className="text-sm text-gray-600">Total Users</p>
        </div>
        <div className="p-4 bg-[#fff4d2] rounded-xl flex flex-col gap-2">
          <h3 className="text-2xl font-bold">{totalRevenue.toLocaleString()}</h3>
          <p className="text-sm text-gray-600">Total Revenue (12 months)</p>
        </div>
        <div className="p-4 bg-[#fff4d2] rounded-xl flex flex-col gap-2">
          <h3 className="text-2xl font-bold">12</h3>
          <p className="text-sm text-gray-600">Months Tracked</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="mb-2 font-semibold">Revenue (Monthly)</div>
          <Bar options={barOptions} data={barDataset} />
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <div className="mb-2 font-semibold">User Growth</div>
          <Line options={lineOptions} data={lineDataset} />
        </div>
      </div>

      {/* Extra: top products / simple metrics area */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow">
          <h4 className="font-semibold mb-3">Quick Metrics</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>Average Monthly Revenue: <strong>{(totalRevenue / 12).toFixed(2)}</strong></li>
            <li>Average New Users / Month: <strong>{Math.round(totalUsers / 12)}</strong></li>
            <li>Active Admins: <strong>3</strong></li>
          </ul>
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <h4 className="font-semibold mb-3">Notes</h4>
          <p className="text-sm text-gray-600">
            Charts are using sample data. Replace `revenueData` and `userGrowth` with real backend values for live analytics.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Statistics;






