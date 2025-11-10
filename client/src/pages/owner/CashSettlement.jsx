import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";

const BRANCHES = [
  { id: "branch-d1", name: "District 1 Flagship", location: "HCMC • District 1" },
  { id: "branch-d7", name: "District 7 Riverside", location: "HCMC • District 7" },
  { id: "branch-hn", name: "Hanoi Crescent", location: "Hanoi • Ba Dinh" },
];

const CYCLE_FILTERS = [
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-60-days", label: "Last 60 days" },
  { value: "custom", label: "Custom range" },
  { value: "all", label: "All time" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "remitted", label: "Remitted" },
  { value: "verified", label: "Verified" },
];

const REMITTANCE_DATA = [
  {
    id: "RM-2025-11-W2",
    branchId: "branch-d1",
    branchName: "District 1 Flagship",
    cycleLabel: "Week 2 · Nov 2025",
    cycleType: "Weekly",
    totalOrders: 124,
    grossCod: 48600000,
    vat: 4860000,
    platformFee: 2916000,
    totalDue: 7776000,
    remittedAmount: 5200000,
    status: "Remitted",
    remittanceDate: "2025-11-09",
    details: [
      {
        id: "COD-FF-20991",
        orderDate: "2025-11-07T11:32:00+07:00",
        grossAmount: 750000,
        platformFee: 52500,
        vat: 75000,
        totalDue: 127500,
        remittedAmount: 0,
        status: "Pending",
        proof: null,
      },
      {
        id: "COD-FF-20941",
        orderDate: "2025-11-06T19:15:00+07:00",
        grossAmount: 890000,
        platformFee: 62300,
        vat: 89000,
        totalDue: 151300,
        remittedAmount: 151300,
        status: "Verified",
        proof: "TXN-8FG92",
      },
      {
        id: "COD-FF-20910",
        orderDate: "2025-11-05T16:05:00+07:00",
        grossAmount: 1020000,
        platformFee: 71400,
        vat: 102000,
        totalDue: 173400,
        remittedAmount: 173400,
        status: "Verified",
        proof: "TXN-8FG11",
      },
    ],
  },
  {
    id: "RM-2025-11-W2-D7",
    branchId: "branch-d7",
    branchName: "District 7 Riverside",
    cycleLabel: "Week 2 · Nov 2025",
    cycleType: "Weekly",
    totalOrders: 98,
    grossCod: 36500000,
    vat: 3650000,
    platformFee: 2190000,
    totalDue: 5840000,
    remittedAmount: 2500000,
    status: "Pending",
    remittanceDate: "2025-11-10",
    details: [
      {
        id: "COD-FF-20891",
        orderDate: "2025-11-06T14:20:00+07:00",
        grossAmount: 620000,
        platformFee: 43400,
        vat: 62000,
        totalDue: 105400,
        remittedAmount: 0,
        status: "Pending",
        proof: null,
      },
      {
        id: "COD-FF-20855",
        orderDate: "2025-11-05T12:40:00+07:00",
        grossAmount: 780000,
        platformFee: 54600,
        vat: 78000,
        totalDue: 132600,
        remittedAmount: 80000,
        status: "Remitted",
        proof: "TXN-9GH30",
      },
    ],
  },
  {
    id: "RM-2025-10-M",
    branchId: "branch-hn",
    branchName: "Hanoi Crescent",
    cycleLabel: "Month · Oct 2025",
    cycleType: "Monthly",
    totalOrders: 312,
    grossCod: 114600000,
    vat: 11460000,
    platformFee: 6876000,
    totalDue: 18336000,
    remittedAmount: 18336000,
    status: "Verified",
    remittanceDate: "2025-11-02",
    details: [
      {
        id: "COD-FF-20771",
        orderDate: "2025-10-29T09:25:00+07:00",
        grossAmount: 690000,
        platformFee: 48300,
        vat: 69000,
        totalDue: 117300,
        remittedAmount: 117300,
        status: "Verified",
        proof: "TXN-6CD12",
      },
      {
        id: "COD-FF-20718",
        orderDate: "2025-10-26T18:20:00+07:00",
        grossAmount: 840000,
        platformFee: 58800,
        vat: 84000,
        totalDue: 142800,
        remittedAmount: 142800,
        status: "Verified",
        proof: "TXN-6CD88",
      },
    ],
  },
  {
    id: "RM-2025-11-W1-TD",
    branchId: "branch-d1",
    branchName: "District 1 Flagship",
    cycleLabel: "Week 1 · Nov 2025",
    cycleType: "Weekly",
    totalOrders: 118,
    grossCod: 44800000,
    vat: 4480000,
    platformFee: 2688000,
    totalDue: 7168000,
    remittedAmount: 7168000,
    status: "Verified",
    remittanceDate: "2025-11-03",
    details: [
      {
        id: "COD-FF-20666",
        orderDate: "2025-11-01T10:15:00+07:00",
        grossAmount: 560000,
        platformFee: 39200,
        vat: 56000,
        totalDue: 95200,
        remittedAmount: 95200,
        status: "Verified",
        proof: "TXN-5BB12",
      },
    ],
  },
];

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const formatCurrency = (value) => currencyFormatter.format(value || 0);

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const StatusBadge = ({ status }) => {
  const normalized = (status || "").toLowerCase();
  const className = {
    pending: "bg-amber-100 text-amber-800",
    remitted: "bg-blue-100 text-blue-700",
    verified: "bg-emerald-100 text-emerald-700",
  }[normalized] || "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}>
      {status}
    </span>
  );
};

const CashSettlement = () => {
  const [remittances, setRemittances] = useState(REMITTANCE_DATA);
  const [filters, setFilters] = useState({
    branch: "all",
    cycle: "this-month",
    status: "all",
    amountMin: "",
    amountMax: "",
    search: "",
  });
  const [customCycle, setCustomCycle] = useState({ start: "", end: "" });
  const [selectedRemittance, setSelectedRemittance] = useState(null);

  const matchCycleFilter = (remittance) => {
    if (filters.cycle === "all") return true;
    const remittanceDate = new Date(remittance.remittanceDate);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    switch (filters.cycle) {
      case "this-week":
        return remittanceDate >= startOfWeek;
      case "this-month":
        return (
          remittanceDate.getFullYear() === now.getFullYear() &&
          remittanceDate.getMonth() === now.getMonth()
        );
      case "last-month":
        return (
          remittanceDate.getFullYear() === startOfLastMonth.getFullYear() &&
          remittanceDate.getMonth() === startOfLastMonth.getMonth()
        );
      case "last-60-days": {
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(now.getDate() - 60);
        return remittanceDate >= sixtyDaysAgo && remittanceDate <= now;
      }
      case "custom": {
        if (!customCycle.start || !customCycle.end) return true;
        const start = new Date(customCycle.start);
        const end = new Date(customCycle.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
        return remittanceDate >= start && remittanceDate <= end;
      }
      default:
        return true;
    }
  };

  const filteredRemittances = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    const minAmount = filters.amountMin ? Number(filters.amountMin) : null;
    const maxAmount = filters.amountMax ? Number(filters.amountMax) : null;

    return remittances.filter((remittance) => {
      const matchesBranch = filters.branch === "all" || remittance.branchId === filters.branch;
      const matchesStatus = filters.status === "all" || remittance.status.toLowerCase() === filters.status;
      const matchesCycle = matchCycleFilter(remittance);
      const matchesSearch =
        !keyword ||
        remittance.id.toLowerCase().includes(keyword) ||
        remittance.cycleLabel.toLowerCase().includes(keyword);
      const matchesAmount = (() => {
        if (minAmount !== null && !Number.isNaN(minAmount) && remittance.totalDue < minAmount) return false;
        if (maxAmount !== null && !Number.isNaN(maxAmount) && remittance.totalDue > maxAmount) return false;
        return true;
      })();
      return matchesBranch && matchesStatus && matchesCycle && matchesSearch && matchesAmount;
    });
  }, [remittances, filters, customCycle]);

  const branchSummary = useMemo(() => {
    return filteredRemittances.reduce(
      (acc, remittance) => {
        acc.collected += remittance.grossCod;
        acc.vat += remittance.vat;
        acc.dues += remittance.totalDue;
        acc.remitted += remittance.remittedAmount;
        return acc;
      },
      { collected: 0, vat: 0, dues: 0, remitted: 0 },
    );
  }, [filteredRemittances]);

  const analyticsByBranch = useMemo(() => {
    const map = new Map();
    filteredRemittances.forEach((remittance) => {
      map.set(remittance.branchName, (map.get(remittance.branchName) || 0) + remittance.remittedAmount);
    });
    return Array.from(map.entries()).map(([branch, value]) => ({ branch, value }));
  }, [filteredRemittances]);

  const analyticsMax = useMemo(() => {
    if (!analyticsByBranch.length) return 1;
    return Math.max(...analyticsByBranch.map((item) => item.value)) || 1;
  }, [analyticsByBranch]);

  const outstanding = branchSummary.dues - branchSummary.remitted;
  const showBranchColumn = filters.branch === "all";
  const showCustomRange = filters.cycle === "custom";

  const handleViewDetails = (remittance) => {
    setSelectedRemittance(remittance);
  };

  const handleDownloadSummary = (remittance) => {
    toast.success(`Report ready for ${remittance.id}`);
  };

  const handleUploadProof = (remittance) => {
    toast.success(`Upload proof placeholder for ${remittance.id}`);
  };

  const handleExportFiltered = () => {
    toast.success("Cash settlement CSV queued");
  };

  const handleConfirmDetail = (detailId) => {
    if (!selectedRemittance) return;
    const updatedData = remittances.map((remittance) => {
      if (remittance.id !== selectedRemittance.id) return remittance;
      const details = remittance.details.map((detail) =>
        detail.id === detailId
          ? {
              ...detail,
              remittedAmount: detail.totalDue,
              status: "Verified",
              proof: detail.proof || `PROOF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            }
          : detail,
      );
      const remittedAmount = details.reduce((sum, detail) => sum + detail.remittedAmount, 0);
      const status = remittedAmount >= remittance.totalDue ? "Verified" : remittedAmount > 0 ? "Remitted" : "Pending";
      return { ...remittance, details, remittedAmount, status };
    });
    setRemittances(updatedData);
    const updatedSelection = updatedData.find((rem) => rem.id === selectedRemittance.id) || null;
    setSelectedRemittance(updatedSelection);
    toast.success(`Remittance confirmed for ${detailId}`);
  };

  const handleUploadDetailProof = (detailId) => {
    if (!selectedRemittance) return;
    const updatedData = remittances.map((remittance) => {
      if (remittance.id !== selectedRemittance.id) return remittance;
      const details = remittance.details.map((detail) =>
        detail.id === detailId
          ? {
              ...detail,
              proof: detail.proof || `PROOF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            }
          : detail,
      );
      return { ...remittance, details };
    });
    setRemittances(updatedData);
    const updatedSelection = updatedData.find((rem) => rem.id === selectedRemittance.id) || null;
    setSelectedRemittance(updatedSelection);
    toast.success(`Proof uploaded for ${detailId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">COD cash control</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cash Settlement</h1>
            <p className="text-sm text-slate-500">Monitor COD collections, fees due, and remittances across branches.</p>
          </div>
          <div className="text-sm text-slate-600">
            Scope:{" "}
            <span className="font-semibold text-slate-900">
              {filters.branch === "all"
                ? "All branches"
                : BRANCHES.find((branch) => branch.id === filters.branch)?.name || "Branch"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Branches
            <select
              value={filters.branch}
              onChange={(event) => setFilters((prev) => ({ ...prev, branch: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
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
            Date range / cycle
            <select
              value={filters.cycle}
              onChange={(event) => setFilters((prev) => ({ ...prev, cycle: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {CYCLE_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Amount range (VND)
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={filters.amountMin}
                onChange={(event) => setFilters((prev) => ({ ...prev, amountMin: event.target.value }))}
                placeholder="Min"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                value={filters.amountMax}
                onChange={(event) => setFilters((prev) => ({ ...prev, amountMax: event.target.value }))}
                placeholder="Max"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </label>
        </div>
        {showCustomRange && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Start date
              <input
                type="date"
                value={customCycle.start}
                onChange={(event) => setCustomCycle((prev) => ({ ...prev, start: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              End date
              <input
                type="date"
                value={customCycle.end}
                onChange={(event) => setCustomCycle((prev) => ({ ...prev, end: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </label>
          </div>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search remittance ID or cycle"
              className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setFilters({
                  branch: "all",
                  cycle: "this-month",
                  status: "all",
                  amountMin: "",
                  amountMax: "",
                  search: "",
                });
                setCustomCycle({ start: "", end: "" });
                setSelectedRemittance(null);
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
            >
              Reset
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

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total COD collected" value={formatCurrency(branchSummary.collected)} helper="Gross cash in scope" />
        <SummaryCard title="Total fee due" value={formatCurrency(branchSummary.dues)} helper="VAT + platform fee" />
        <SummaryCard title="Total remitted" value={formatCurrency(branchSummary.remitted)} helper="Sent to FoodFast" />
        <SummaryCard title="Remaining" value={formatCurrency(Math.max(0, outstanding))} helper="Pending or verifying" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Remittance summary</p>
            <p className="text-sm text-slate-500">Each COD remittance cycle with obligations and status.</p>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Updated {formatDate(new Date().toISOString())}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Cycle / Period</th>
                {showBranchColumn && <th className="px-5 py-3">Branch</th>}
                <th className="px-5 py-3">COD orders</th>
                <th className="px-5 py-3">Gross COD</th>
                <th className="px-5 py-3">VAT</th>
                <th className="px-5 py-3">Total due</th>
                <th className="px-5 py-3">Remitted</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Remittance date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRemittances.length ? (
                filteredRemittances.map((remittance) => (
                  <tr key={remittance.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{remittance.id}</p>
                      <p className="text-xs text-slate-500">{remittance.cycleLabel}</p>
                    </td>
                    {showBranchColumn && (
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{remittance.branchName}</p>
                        <p className="text-xs text-slate-500">
                          {BRANCHES.find((branch) => branch.id === remittance.branchId)?.location}
                        </p>
                      </td>
                    )}
                    <td className="px-5 py-4 font-semibold text-slate-900">{remittance.totalOrders}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(remittance.grossCod)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatCurrency(remittance.vat)}</td>
                    <td className="px-5 py-4 text-slate-900">{formatCurrency(remittance.totalDue)}</td>
                    <td className="px-5 py-4 text-emerald-600">{formatCurrency(remittance.remittedAmount)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={remittance.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(remittance.remittanceDate)}</td>
                    <td className="px-5 py-4 text-right space-y-2">
                      <button
                        type="button"
                        onClick={() => handleViewDetails(remittance)}
                        className="block w-full rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUploadProof(remittance)}
                        className="block w-full rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        Upload proof
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSummary(remittance)}
                        className="block w-full rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        Download report
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={showBranchColumn ? 10 : 9} className="px-5 py-12 text-center text-sm text-slate-500">
                    No remittance cycles match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRemittance ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">{selectedRemittance.cycleType}</p>
              <h2 className="text-xl font-bold text-slate-900">{selectedRemittance.cycleLabel}</h2>
              <p className="text-sm text-slate-500">
                {selectedRemittance.branchName} · {selectedRemittance.totalOrders} COD orders
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(Math.max(0, selectedRemittance.totalDue - selectedRemittance.remittedAmount))}
              </p>
              <p className="text-xs text-slate-500">Due date {formatDate(selectedRemittance.remittanceDate)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Order date</th>
                  <th className="px-5 py-3">Gross amount</th>
                  <th className="px-5 py-3">Platform fee</th>
                  <th className="px-5 py-3">VAT</th>
                  <th className="px-5 py-3">Total due</th>
                  <th className="px-5 py-3">Remitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Proof / Transaction</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {selectedRemittance.details.map((detail) => (
                  <tr key={detail.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-semibold text-slate-900">{detail.id}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(detail.orderDate)}</td>
                    <td className="px-5 py-3 text-slate-900">{formatCurrency(detail.grossAmount)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatCurrency(detail.platformFee)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatCurrency(detail.vat)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{formatCurrency(detail.totalDue)}</td>
                    <td className="px-5 py-3 text-emerald-600">{formatCurrency(detail.remittedAmount)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={detail.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{detail.proof || "—"}</td>
                    <td className="px-5 py-3 text-right space-y-2">
                      {detail.status !== "Verified" && (
                        <button
                          type="button"
                          onClick={() => handleConfirmDetail(detail.id)}
                          className="block w-full rounded-full border border-emerald-500 px-4 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                        >
                          Confirm remittance
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleUploadDetailProof(detail.id)}
                        className="block w-full rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        Upload proof
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Branch analytics</p>
            <p className="text-sm text-slate-500">Compare remitted amounts between branches for the selected filters.</p>
          </div>
          <button
            type="button"
            onClick={() => toast.success("Analytics exported")}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Export chart
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {analyticsByBranch.length ? (
            analyticsByBranch.map((item) => {
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
            <p className="py-6 text-center text-sm text-slate-500">No analytics available for the current selection.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value, helper }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500">{helper}</p>
  </div>
);

export default CashSettlement;
