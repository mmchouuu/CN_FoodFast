import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";

const offsetDateOnly = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const offsetDateTime = (days, hour = 10, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const rangeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const buildCycleLabel = (startISO, endISO) =>
  `${rangeFormatter.format(new Date(startISO))} – ${rangeFormatter.format(new Date(endISO))}`;

const BRANCHES = [
  { id: "branch-d1", name: "District 1 Flagship", location: "HCMC · District 1" },
  { id: "branch-d7", name: "District 7 Riverside", location: "HCMC · District 7" },
  { id: "branch-hn", name: "Hanoi Crescent", location: "Hanoi · Ba Dinh" },
];

const DATE_FILTERS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-90-days", label: "Last 90 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
];

const settlementPeriods = [
  { start: offsetDateOnly(-9), end: offsetDateOnly(-3), payout: offsetDateOnly(-2) },
  { start: offsetDateOnly(-16), end: offsetDateOnly(-10), payout: offsetDateOnly(-9) },
  { start: offsetDateOnly(-33), end: offsetDateOnly(-19), payout: offsetDateOnly(-18) },
  { start: offsetDateOnly(-45), end: offsetDateOnly(-31), payout: offsetDateOnly(-30) },
  { start: offsetDateOnly(-65), end: offsetDateOnly(-52), payout: offsetDateOnly(-51) },
];

const SETTLEMENTS = [
  {
    id: `PAYOUT-${settlementPeriods[0].end.replace(/-/g, "")}`,
    payoutCycle: `Weekly cycle · ${buildCycleLabel(settlementPeriods[0].start, settlementPeriods[0].end)}`,
    branchId: "branch-d1",
    branchName: "District 1 Flagship",
    totalOrders: 112,
    grossSales: 86500000,
    platformFee: 4100000,
    vat: 8650000,
    deliveryFee: 2150000,
    netAmount: 71650000,
    status: "Pending",
    payoutDate: settlementPeriods[0].payout,
    periodStart: settlementPeriods[0].start,
    periodEnd: settlementPeriods[0].end,
    orders: [
      {
        id: "FF-10945",
        orderDate: offsetDateTime(-4, 11, 20),
        branchName: "District 1 Flagship",
        totalSales: 1250000,
        platformFee: 60000,
        vat: 125000,
        deliveryFee: 25000,
        netReceived: 1040000,
        paymentMethod: "MoMo",
        status: "Paid",
      },
      {
        id: "FF-10912",
        orderDate: offsetDateTime(-5, 9, 15),
        branchName: "District 1 Flagship",
        totalSales: 980000,
        platformFee: 48000,
        vat: 98000,
        deliveryFee: 20000,
        netReceived: 814000,
        paymentMethod: "Stripe",
        status: "Paid",
      },
      {
        id: "FF-10888",
        orderDate: offsetDateTime(-6, 20, 5),
        branchName: "District 1 Flagship",
        totalSales: 1450000,
        platformFee: 72000,
        vat: 145000,
        deliveryFee: 35000,
        netReceived: 1200000,
        paymentMethod: "Visa",
        status: "Pending",
      },
    ],
  },
  {
    id: `PAYOUT-${settlementPeriods[1].end.replace(/-/g, "")}`,
    payoutCycle: `Weekly cycle · ${buildCycleLabel(settlementPeriods[1].start, settlementPeriods[1].end)}`,
    branchId: "branch-d7",
    branchName: "District 7 Riverside",
    totalOrders: 96,
    grossSales: 64800000,
    platformFee: 2950000,
    vat: 6480000,
    deliveryFee: 1850000,
    netAmount: 53570000,
    status: "Processing",
    payoutDate: settlementPeriods[1].payout,
    periodStart: settlementPeriods[1].start,
    periodEnd: settlementPeriods[1].end,
    orders: [
      {
        id: "FF-10771",
        orderDate: offsetDateTime(-11, 14, 30),
        branchName: "District 7 Riverside",
        totalSales: 890000,
        platformFee: 42000,
        vat: 89000,
        deliveryFee: 15000,
        netReceived: 744000,
        paymentMethod: "Stripe",
        status: "Processing",
      },
      {
        id: "FF-10740",
        orderDate: offsetDateTime(-12, 16, 10),
        branchName: "District 7 Riverside",
        totalSales: 770000,
        platformFee: 36000,
        vat: 77000,
        deliveryFee: 0,
        netReceived: 657000,
        paymentMethod: "MoMo",
        status: "Paid",
      },
      {
        id: "FF-10701",
        orderDate: offsetDateTime(-13, 18, 45),
        branchName: "District 7 Riverside",
        totalSales: 1010000,
        platformFee: 48000,
        vat: 101000,
        deliveryFee: 25000,
        netReceived: 836000,
        paymentMethod: "Stripe",
        status: "Pending",
      },
    ],
  },
  {
    id: `PAYOUT-${settlementPeriods[2].end.replace(/-/g, "")}`,
    payoutCycle: `Bi-weekly · ${buildCycleLabel(settlementPeriods[2].start, settlementPeriods[2].end)}`,
    branchId: "branch-hn",
    branchName: "Hanoi Crescent",
    totalOrders: 142,
    grossSales: 71200000,
    platformFee: 3120000,
    vat: 7120000,
    deliveryFee: 1650000,
    netAmount: 59330000,
    status: "Paid",
    payoutDate: settlementPeriods[2].payout,
    periodStart: settlementPeriods[2].start,
    periodEnd: settlementPeriods[2].end,
    orders: [
      {
        id: "FF-10601",
        orderDate: offsetDateTime(-22, 19, 12),
        branchName: "Hanoi Crescent",
        totalSales: 1150000,
        platformFee: 52000,
        vat: 115000,
        deliveryFee: 20000,
        netReceived: 964000,
        paymentMethod: "MoMo",
        status: "Paid",
      },
      {
        id: "FF-10588",
        orderDate: offsetDateTime(-23, 11, 5),
        branchName: "Hanoi Crescent",
        totalSales: 760000,
        platformFee: 34000,
        vat: 76000,
        deliveryFee: 0,
        netReceived: 650000,
        paymentMethod: "Visa",
        status: "Paid",
      },
      {
        id: "FF-10560",
        orderDate: offsetDateTime(-24, 13, 25),
        branchName: "Hanoi Crescent",
        totalSales: 990000,
        platformFee: 43000,
        vat: 99000,
        deliveryFee: 20000,
        netReceived: 828000,
        paymentMethod: "MoMo",
        status: "Paid",
      },
    ],
  },
  {
    id: `PAYOUT-${settlementPeriods[3].end.replace(/-/g, "")}`,
    payoutCycle: `Weekly cycle · ${buildCycleLabel(settlementPeriods[3].start, settlementPeriods[3].end)}`,
    branchId: "branch-d1",
    branchName: "District 1 Flagship",
    totalOrders: 124,
    grossSales: 91200000,
    platformFee: 4360000,
    vat: 9120000,
    deliveryFee: 1980000,
    netAmount: 75740000,
    status: "Paid",
    payoutDate: settlementPeriods[3].payout,
    periodStart: settlementPeriods[3].start,
    periodEnd: settlementPeriods[3].end,
    orders: [
      {
        id: "FF-10543",
        orderDate: offsetDateTime(-34, 15, 5),
        branchName: "District 1 Flagship",
        totalSales: 1320000,
        platformFee: 60000,
        vat: 132000,
        deliveryFee: 35000,
        netReceived: 1093000,
        paymentMethod: "Stripe",
        status: "Paid",
      },
      {
        id: "FF-10530",
        orderDate: offsetDateTime(-35, 10, 45),
        branchName: "District 1 Flagship",
        totalSales: 1010000,
        platformFee: 48000,
        vat: 101000,
        deliveryFee: 15000,
        netReceived: 854000,
        paymentMethod: "MoMo",
        status: "Paid",
      },
    ],
  },
  {
    id: `PAYOUT-${settlementPeriods[4].end.replace(/-/g, "")}`,
    payoutCycle: `Monthly · ${buildCycleLabel(settlementPeriods[4].start, settlementPeriods[4].end)}`,
    branchId: "branch-d7",
    branchName: "District 7 Riverside",
    totalOrders: 188,
    grossSales: 104500000,
    platformFee: 4880000,
    vat: 10450000,
    deliveryFee: 3120000,
    netAmount: 86170000,
    status: "Paid",
    payoutDate: settlementPeriods[4].payout,
    periodStart: settlementPeriods[4].start,
    periodEnd: settlementPeriods[4].end,
    orders: [
      {
        id: "FF-10488",
        orderDate: offsetDateTime(-54, 17, 30),
        branchName: "District 7 Riverside",
        totalSales: 1420000,
        platformFee: 68000,
        vat: 142000,
        deliveryFee: 30000,
        netReceived: 1180000,
        paymentMethod: "Stripe",
        status: "Paid",
      },
      {
        id: "FF-10460",
        orderDate: offsetDateTime(-55, 12, 10),
        branchName: "District 7 Riverside",
        totalSales: 910000,
        platformFee: 40000,
        vat: 91000,
        deliveryFee: 18000,
        netReceived: 761000,
        paymentMethod: "MoMo",
        status: "Paid",
      },
    ],
  },
];

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const formatCurrency = (value) => currencyFormatter.format(value || 0);
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return dateFormatter.format(date);
};

const StatusBadge = ({ status }) => {
  const normalized = (status || "").toLowerCase();
  const className = {
    pending: "bg-amber-100 text-amber-800",
    processing: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
  }[normalized] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}>
      {status}
    </span>
  );
};

const SummaryCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500">{helper}</p>
  </div>
);

const SettlementReports = () => {
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("this-month");
  const [searchTerm, setSearchTerm] = useState("");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [selectedPayout, setSelectedPayout] = useState(null);

  const matchDateFilter = (payout) => {
    const payoutDate = new Date(payout.payoutDate);
    if (dateFilter === "all") return true;
    const now = new Date();

    if (dateFilter === "this-month") {
      return payoutDate.getFullYear() === now.getFullYear() && payoutDate.getMonth() === now.getMonth();
    }
    if (dateFilter === "last-month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return payoutDate.getMonth() === lastMonth.getMonth() && payoutDate.getFullYear() === lastMonth.getFullYear();
    }
    if (dateFilter === "last-90-days") {
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return payoutDate >= ninetyDaysAgo && payoutDate <= now;
    }
    if (dateFilter === "custom") {
      if (!customDates.start || !customDates.end) return true;
      const start = new Date(customDates.start);
      const end = new Date(customDates.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
      return payoutDate >= start && payoutDate <= end;
    }
    return true;
  };

  const filteredSettlements = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return SETTLEMENTS.filter((payout) => {
      const matchesBranch = branchFilter === "all" || payout.branchId === branchFilter;
      const matchesStatus = statusFilter === "all" || payout.status.toLowerCase() === statusFilter;
      const matchesSearch =
        !keyword ||
        payout.id.toLowerCase().includes(keyword) ||
        payout.payoutCycle.toLowerCase().includes(keyword);
      return matchesBranch && matchesStatus && matchesSearch && matchDateFilter(payout);
    });
  }, [branchFilter, statusFilter, searchTerm, dateFilter, customDates]);

  const summary = useMemo(() => {
    return filteredSettlements.reduce(
      (acc, payout) => {
        acc.gross += payout.grossSales;
        acc.vat += payout.vat;
        acc.net += payout.netAmount;
        acc.orders += payout.totalOrders;
        return acc;
      },
      { gross: 0, vat: 0, net: 0, orders: 0 },
    );
  }, [filteredSettlements]);

  const analytics = useMemo(() => {
    const map = new Map();
    filteredSettlements.forEach((payout) => {
      map.set(payout.branchName, (map.get(payout.branchName) || 0) + payout.netAmount);
    });
    return Array.from(map.entries()).map(([branch, value]) => ({ branch, value }));
  }, [filteredSettlements]);

  const analyticsMax = useMemo(() => {
    if (!analytics.length) return 1;
    return Math.max(...analytics.map((entry) => entry.value)) || 1;
  }, [analytics]);

  const activeBranch = branchFilter === "all" ? "All branches" : BRANCHES.find((branch) => branch.id === branchFilter)?.name || "Branch";
  const showBranchColumn = branchFilter === "all";
  const showCustomRange = dateFilter === "custom";

  const handleDownloadSettlement = (payout) => {
    toast.success(`Download scheduled for ${payout.id}`);
  };

  const handleViewProof = (payout) => {
    toast.success(`Proof ready for ${payout.id}`);
  };

  const handleExportFiltered = () => {
    toast.success("CSV export queued for current filters");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">Settlement Center</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Settlement Reports</h1>
            <p className="text-sm text-slate-500">Review online payouts FoodFast has collected and remitted for your branches.</p>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            Scope: <span className="text-slate-900">{activeBranch}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total Online Sales" value={formatCurrency(summary.gross)} helper={`Across ${summary.orders} orders`} />
        <SummaryCard label="Total VAT" value={formatCurrency(summary.vat)} helper="Tax withheld per payout cycle" />
        <SummaryCard label="Net earnings" value={formatCurrency(summary.net)} helper="Transfer amount after all fees" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Branch
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="all">All branches</option>
              {BRANCHES.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date range
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {DATE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search payout
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Payout ID or cycle"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </label>
        </div>
        {showCustomRange ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Start date
              <input
                type="date"
                value={customDates.start}
                onChange={(event) => setCustomDates((prev) => ({ ...prev, start: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              End date
              <input
                type="date"
                value={customDates.end}
                onChange={(event) => setCustomDates((prev) => ({ ...prev, end: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </label>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-900">{filteredSettlements.length}</span> payout cycles
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setBranchFilter("all");
                setStatusFilter("all");
                setDateFilter("this-month");
                setCustomDates({ start: "", end: "" });
                setSearchTerm("");
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
            >
              Reset filters
            </button>
            <button
              type="button"
              onClick={handleExportFiltered}
              className="rounded-full border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Settlement table</p>
            <p className="text-sm text-slate-500">Reference each payout cycle, fees withheld, and transfer status.</p>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Updated {formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Payout ID / Cycle</th>
                {showBranchColumn && <th className="px-5 py-3">Branch</th>}
                <th className="px-5 py-3">Total orders</th>
                <th className="px-5 py-3">Gross sales</th>
                <th className="px-5 py-3">Platform fee</th>
                <th className="px-5 py-3">VAT</th>
                <th className="px-5 py-3">Delivery fee</th>
                <th className="px-5 py-3">Net amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Payout date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredSettlements.length ? (
                filteredSettlements.map((payout) => (
                  <tr key={payout.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{payout.id}</p>
                      <p className="text-xs text-slate-500">{payout.payoutCycle}</p>
                    </td>
                    {showBranchColumn && (
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{payout.branchName}</p>
                        <p className="text-xs text-slate-500">
                          {BRANCHES.find((branch) => branch.id === payout.branchId)?.location}
                        </p>
                      </td>
                    )}
                    <td className="px-5 py-4 font-semibold text-slate-900">{payout.totalOrders}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(payout.grossSales)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatCurrency(payout.platformFee)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatCurrency(payout.vat)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatCurrency(payout.deliveryFee)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-600">{formatCurrency(payout.netAmount)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={payout.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(payout.payoutDate)}</td>
                    <td className="px-5 py-4 text-right space-y-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPayout(payout)}
                        className="block w-full rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      >
                        View orders
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSettlement(payout)}
                        className="block w-full rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewProof(payout)}
                        className="block w-full rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      >
                        View proof
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={showBranchColumn ? 11 : 10} className="px-5 py-10 text-center text-sm text-slate-500">
                    No payout cycles match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Branch analytics</p>
            <p className="text-sm text-slate-500">Net earnings contributed by each branch within the selected filters.</p>
          </div>
          <button
            type="button"
            onClick={() => toast.success("Branch analytics downloaded")}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Export chart
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {analytics.length ? (
            analytics.map((item) => {
              const width = Math.max(8, Math.round((item.value / analyticsMax) * 100));
              return (
                <div key={item.branch}>
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold text-slate-900">{item.branch}</p>
                    <p className="text-slate-600">{formatCurrency(item.value)}</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No data available for the current selection.</p>
          )}
        </div>
      </div>

      <OrdersModal payout={selectedPayout} onClose={() => setSelectedPayout(null)} />
    </div>
  );
};

const OrdersModal = ({ payout, onClose }) => {
  if (!payout) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-orange-500">{payout.id}</p>
            <h2 className="text-xl font-bold text-slate-900">{payout.payoutCycle}</h2>
            <p className="text-sm text-slate-500">
              {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)} · {payout.totalOrders} orders
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-500">Net received</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(payout.netAmount)}</p>
          </div>
        </div>
        <div className="max-h-[480px] overflow-y-auto px-6 py-4">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Order date</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Total sales</th>
                <th className="px-4 py-3">Platform fee</th>
                <th className="px-4 py-3">VAT</th>
                <th className="px-4 py-3">Net received</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {payout.orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{order.id}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.orderDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{order.branchName}</td>
                  <td className="px-4 py-3 text-slate-900">{formatCurrency(order.totalSales)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(order.platformFee)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(order.vat)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(order.netReceived)}</td>
                  <td className="px-4 py-3 text-slate-600">{order.paymentMethod}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm text-slate-500">
            <p>
              Payout date: <span className="font-semibold text-slate-900">{formatDate(payout.payoutDate)}</span>
            </p>
            <p>Delivery fees include courier reimbursements.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => toast.success("Order detail exported")}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
            >
              Export detail
            </button>
            <button
              type="button"
              onClick={() => toast.success("Proof downloaded")}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
            >
              View proof
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementReports;
