import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partially Paid" },
  { value: "completed", label: "Completed" },
];

const DUE_FILTERS = [
  { value: "all", label: "All dues" },
  { value: "overdue", label: "Overdue only" },
  { value: "due-soon", label: "Due within 3 days" },
];

const COD_RESTAURANTS = [
  {
    id: "rest-urban",
    name: "Urban Eats Collective",
    totalCodSales: 184500000,
    totalFeeDue: 36500000,
    totalRemitted: 28700000,
    outstanding: 7800000,
    status: "Partially Paid",
    nextDueDate: "2025-11-12",
    branches: [
      {
        id: "branch-d1",
        name: "District 1 Flagship",
        location: "HCMC • District 1",
        codOrders: 216,
        grossCodCollected: 98600000,
        platformFeeVat: 19600000,
        remittedAmount: 15800000,
        remaining: 3800000,
        status: "Partially Paid",
        nextDueDate: "2025-11-10",
        details: [
          {
            id: "COD-FF-20991",
            orderDate: "2025-11-07T11:32:00+07:00",
            grossAmount: 750000,
            platformFee: 55000,
            vat: 75000,
            totalDue: 130000,
            remittedAmount: 0,
            status: "Not Remitted",
            proof: null,
          },
          {
            id: "COD-FF-20941",
            orderDate: "2025-11-06T19:15:00+07:00",
            grossAmount: 890000,
            platformFee: 64000,
            vat: 89000,
            totalDue: 153000,
            remittedAmount: 153000,
            status: "Remitted",
            proof: "TXN-8FG92",
          },
          {
            id: "COD-FF-20910",
            orderDate: "2025-11-05T16:05:00+07:00",
            grossAmount: 1020000,
            platformFee: 73500,
            vat: 102000,
            totalDue: 175500,
            remittedAmount: 175500,
            status: "Verified",
            proof: "TXN-8FG11",
          },
        ],
      },
      {
        id: "branch-d7",
        name: "District 7 Riverside",
        location: "HCMC • District 7",
        codOrders: 144,
        grossCodCollected: 68900000,
        platformFeeVat: 13780000,
        remittedAmount: 11200000,
        remaining: 2580000,
        status: "Pending",
        nextDueDate: "2025-11-09",
        details: [
          {
            id: "COD-FF-20891",
            orderDate: "2025-11-06T14:20:00+07:00",
            grossAmount: 620000,
            platformFee: 46500,
            vat: 62000,
            totalDue: 108500,
            remittedAmount: 0,
            status: "Not Remitted",
            proof: null,
          },
          {
            id: "COD-FF-20855",
            orderDate: "2025-11-05T12:40:00+07:00",
            grossAmount: 780000,
            platformFee: 58500,
            vat: 78000,
            totalDue: 136500,
            remittedAmount: 80000,
            status: "Remitted",
            proof: "TXN-9GH30",
          },
        ],
      },
    ],
  },
  {
    id: "rest-green",
    name: "Green Kitchen Vietnam",
    totalCodSales: 136800000,
    totalFeeDue: 27360000,
    totalRemitted: 27360000,
    outstanding: 0,
    status: "Completed",
    nextDueDate: "2025-11-05",
    branches: [
      {
        id: "branch-hn",
        name: "Hanoi Crescent",
        location: "Hanoi • Ba Dinh",
        codOrders: 166,
        grossCodCollected: 74600000,
        platformFeeVat: 14920000,
        remittedAmount: 14920000,
        remaining: 0,
        status: "Paid",
        nextDueDate: "2025-11-04",
        details: [
          {
            id: "COD-FF-20771",
            orderDate: "2025-11-03T09:25:00+07:00",
            grossAmount: 690000,
            platformFee: 51750,
            vat: 69000,
            totalDue: 120750,
            remittedAmount: 120750,
            status: "Verified",
            proof: "TXN-6CD12",
          },
        ],
      },
      {
        id: "branch-da",
        name: "Da Nang Beachfront",
        location: "Da Nang • Son Tra",
        codOrders: 98,
        grossCodCollected: 62200000,
        platformFeeVat: 12440000,
        remittedAmount: 12440000,
        remaining: 0,
        status: "Paid",
        nextDueDate: "2025-11-05",
        details: [
          {
            id: "COD-FF-20718",
            orderDate: "2025-11-02T18:20:00+07:00",
            grossAmount: 840000,
            platformFee: 63000,
            vat: 84000,
            totalDue: 147000,
            remittedAmount: 147000,
            status: "Verified",
            proof: "TXN-6CD88",
          },
        ],
      },
    ],
  },
  {
    id: "rest-street",
    name: "Saigon Street Eats",
    totalCodSales: 98500000,
    totalFeeDue: 19700000,
    totalRemitted: 13800000,
    outstanding: 5900000,
    status: "Pending",
    nextDueDate: "2025-11-11",
    branches: [
      {
        id: "branch-td",
        name: "Thu Duc Central",
        location: "HCMC • Thu Duc",
        codOrders: 122,
        grossCodCollected: 49500000,
        platformFeeVat: 9900000,
        remittedAmount: 7200000,
        remaining: 2700000,
        status: "Pending",
        nextDueDate: "2025-11-10",
        details: [
          {
            id: "COD-FF-20666",
            orderDate: "2025-11-04T15:45:00+07:00",
            grossAmount: 560000,
            platformFee: 42000,
            vat: 56000,
            totalDue: 98000,
            remittedAmount: 0,
            status: "Not Remitted",
            proof: null,
          },
        ],
      },
      {
        id: "branch-bt",
        name: "Binh Thanh Station",
        location: "HCMC • Binh Thanh",
        codOrders: 104,
        grossCodCollected: 49000000,
        platformFeeVat: 9800000,
        remittedAmount: 6600000,
        remaining: 3200000,
        status: "Partially Paid",
        nextDueDate: "2025-11-12",
        details: [
          {
            id: "COD-FF-20620",
            orderDate: "2025-11-03T11:00:00+07:00",
            grossAmount: 610000,
            platformFee: 45750,
            vat: 61000,
            totalDue: 106750,
            remittedAmount: 70000,
            status: "Remitted",
            proof: "TXN-5BB12",
          },
          {
            id: "COD-FF-20600",
            orderDate: "2025-11-02T19:30:00+07:00",
            grossAmount: 730000,
            platformFee: 54750,
            vat: 73000,
            totalDue: 127750,
            remittedAmount: 0,
            status: "Not Remitted",
            proof: null,
          },
        ],
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
  const date = new Date(value);
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

const StatusBadge = ({ status }) => {
  const normalized = (status || "").toLowerCase();
  const className = {
    pending: "bg-amber-100 text-amber-800",
    "partially paid": "bg-blue-100 text-blue-800",
    completed: "bg-emerald-100 text-emerald-800",
    paid: "bg-emerald-100 text-emerald-800",
    "not remitted": "bg-rose-100 text-rose-800",
    remitted: "bg-blue-100 text-blue-800",
    verified: "bg-emerald-100 text-emerald-800",
  }[normalized] || "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}>
      {status}
    </span>
  );
};

const SummaryCard = ({ title, value, helper }) => (
  <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-neutral-500">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
    <p className="text-xs text-neutral-500">{helper}</p>
  </div>
);

const CODSettlements = () => {
  const [data, setData] = useState(COD_RESTAURANTS);
  const [filters, setFilters] = useState({ search: "", status: "all", due: "all" });
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [auditTrail, setAuditTrail] = useState([
    {
      id: "log-1",
      actor: "linh.tran",
      action: "Marked COD remittance as received",
      target: "Urban Eats • District 1 Flagship",
      amount: 153000,
      timestamp: "2025-11-06T21:10:00+07:00",
    },
    {
      id: "log-2",
      actor: "system.cron",
      action: "Reminder sent for overdue remittance",
      target: "Saigon Street Eats • Thu Duc Central",
      amount: null,
      timestamp: "2025-11-05T08:00:00+07:00",
    },
    {
      id: "log-3",
      actor: "david.wong",
      action: "Exported COD audit report",
      target: "October 2025 COD settlements",
      amount: null,
      timestamp: "2025-11-04T17:45:00+07:00",
    },
  ]);

  const selectedRestaurant = data.find((restaurant) => restaurant.id === selectedRestaurantId) || null;
  const selectedBranch =
    selectedRestaurant?.branches.find((branch) => branch.id === selectedBranchId) || null;
  const viewLevel = selectedBranch ? "details" : selectedRestaurant ? "branches" : "restaurants";

  const addAuditEntry = (entry) => {
    setAuditTrail((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actor: entry.actor || "admin.console",
        action: entry.action,
        target: entry.target,
        amount: entry.amount ?? null,
        timestamp: new Date().toISOString(),
      },
      ...prev.slice(0, 7),
    ]);
  };

  const updateRestaurant = (restaurantId, updater) => {
    setData((prev) =>
      prev.map((restaurant) => {
        if (restaurant.id !== restaurantId) return restaurant;
        const updated = updater(restaurant);
        const totals = updated.branches.reduce(
          (acc, branch) => {
            acc.sales += branch.grossCodCollected;
            acc.fee += branch.platformFeeVat;
            acc.remitted += branch.remittedAmount;
            acc.remaining += branch.remaining;
            if (branch.remaining > 0 && branch.remittedAmount > 0) acc.partial += 1;
            if (branch.remaining === 0) acc.paid += 1;
            return acc;
          },
          { sales: 0, fee: 0, remitted: 0, remaining: 0, partial: 0, paid: 0 },
        );
        const outstanding = totals.fee - totals.remitted;
        const status =
          outstanding <= 0 ? "Completed" : totals.remitted > 0 ? "Partially Paid" : "Pending";
        return {
          ...updated,
          totalCodSales: totals.sales,
          totalFeeDue: totals.fee,
          totalRemitted: totals.remitted,
          outstanding,
          status,
        };
      }),
    );
  };

  const handleMarkOrderReceived = (order) => {
    if (!selectedRestaurant || !selectedBranch) return;
    updateRestaurant(selectedRestaurant.id, (restaurant) => {
      const branches = restaurant.branches.map((branch) => {
        if (branch.id !== selectedBranch.id) return branch;
        const details = branch.details.map((item) =>
          item.id === order.id
            ? {
                ...item,
                remittedAmount: item.totalDue,
                status: "Verified",
                proof: item.proof || `TXN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
              }
            : item,
        );
        const remittedAmount = details.reduce((sum, item) => sum + item.remittedAmount, 0);
        const remaining = Math.max(0, branch.platformFeeVat - remittedAmount);
        const status = remaining === 0 ? "Paid" : remittedAmount === 0 ? "Pending" : "Partially Paid";
        return { ...branch, details, remittedAmount, remaining, status };
      });
      return { ...restaurant, branches };
    });
    addAuditEntry({
      action: "Marked COD remittance as received",
      target: order.id,
      amount: order.totalDue,
    });
    toast.success(`Order ${order.id} marked as received`);
  };

  const handleReminder = () => {
    toast.success("Reminder sent to branches with outstanding COD dues");
    addAuditEntry({
      action: "Triggered COD reminder job",
      target: "All pending branches",
      amount: null,
    });
  };

  const handleExport = (level) => {
    const scope =
      level === "restaurants"
        ? "all restaurants"
        : level === "branches"
          ? `${selectedRestaurant?.name} branches`
          : level === "audit"
            ? "COD audit log"
            : `${selectedBranch?.name || "selected branch"} COD details`;
    toast.success(`Exported ${scope} report`);
    addAuditEntry({
      action: "Exported COD settlements",
      target: scope,
    });
  };

  const overview = useMemo(() => {
    return data.reduce(
      (acc, restaurant) => {
        acc.sales += restaurant.totalCodSales;
        acc.due += restaurant.totalFeeDue;
        acc.remitted += restaurant.totalRemitted;
        acc.outstanding += restaurant.outstanding;
        return acc;
      },
      { sales: 0, due: 0, remitted: 0, outstanding: 0 },
    );
  }, [data]);

  const filteredRestaurants = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    const now = new Date();
    return data.filter((restaurant) => {
      const matchesSearch = !keyword || restaurant.name.toLowerCase().includes(keyword);
      const matchesStatus =
        filters.status === "all" || restaurant.status.toLowerCase() === filters.status;
      const matchesDue = (() => {
        if (filters.due === "all") return true;
        const dueDate = new Date(restaurant.nextDueDate);
        if (filters.due === "overdue") return dueDate < now;
        if (filters.due === "due-soon") {
          const soon = new Date(now);
          soon.setDate(soon.getDate() + 3);
          return dueDate >= now && dueDate <= soon;
        }
        return true;
      })();
      return matchesSearch && matchesStatus && matchesDue;
    });
  }, [data, filters]);

  const filteredBranches = useMemo(() => {
    if (!selectedRestaurant) return [];
    const keyword = filters.search.trim().toLowerCase();
    const now = new Date();
    return selectedRestaurant.branches.filter((branch) => {
      const matchesSearch =
        !keyword ||
        branch.name.toLowerCase().includes(keyword) ||
        branch.location.toLowerCase().includes(keyword);
      const matchesStatus =
        filters.status === "all" || branch.status.toLowerCase() === filters.status;
      const matchesDue = (() => {
        if (filters.due === "all") return true;
        const dueDate = new Date(branch.nextDueDate);
        if (filters.due === "overdue") return dueDate < now;
        if (filters.due === "due-soon") {
          const soon = new Date(now);
          soon.setDate(soon.getDate() + 3);
          return dueDate >= now && dueDate <= soon;
        }
        return true;
      })();
      return matchesSearch && matchesStatus && matchesDue;
    });
  }, [selectedRestaurant, filters]);

  const filteredDetails = useMemo(() => {
    if (!selectedBranch) return [];
    const keyword = filters.search.trim().toLowerCase();
    return selectedBranch.details.filter((detail) => {
      if (!keyword) return true;
      return (
        detail.id.toLowerCase().includes(keyword) ||
        (detail.proof || "").toLowerCase().includes(keyword)
      );
    });
  }, [selectedBranch, filters.search]);

  const breadcrumb = [
    { label: "Restaurants", isActive: viewLevel === "restaurants" },
    ...(selectedRestaurant
      ? [{ label: selectedRestaurant.name, isActive: viewLevel === "branches" }]
      : []),
    ...(selectedBranch ? [{ label: selectedBranch.name, isActive: true }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">COD Settlements</h1>
          <p className="text-sm text-neutral-600">
            Track cash-on-delivery collections, platform fees, and remittances from restaurant branches.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(selectedRestaurant || selectedBranch) && (
            <button
              type="button"
              onClick={() => {
                if (selectedBranchId) {
                  setSelectedBranchId(null);
                } else {
                  setSelectedRestaurantId(null);
                }
              }}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={handleReminder}
            className="rounded-full border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50"
          >
            Auto reminder
          </button>
          <button
            type="button"
            onClick={() => handleExport(viewLevel)}
            className="rounded-full border border-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total COD sales" value={formatCurrency(overview.sales)} helper="All restaurants" />
        <SummaryCard title="Total fees due" value={formatCurrency(overview.due)} helper="Platform fee + VAT" />
        <SummaryCard title="Remitted" value={formatCurrency(overview.remitted)} helper="Received from branches" />
        <SummaryCard title="Outstanding" value={formatCurrency(overview.outstanding)} helper="Still to be remitted" />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-neutral-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap gap-3">
            <FilterSelect
              label="Status"
              value={filters.status}
              options={STATUS_FILTERS}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            />
            <FilterSelect
              label="Due window"
              value={filters.due}
              options={DUE_FILTERS}
              onChange={(value) => setFilters((prev) => ({ ...prev, due: value }))}
            />
          </div>
          <div className="relative w-full lg:w-80">
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder={
                viewLevel === "restaurants"
                  ? "Search restaurant"
                  : viewLevel === "branches"
                    ? "Search branch"
                    : "Search order or proof"
              }
              className="w-full rounded-lg border border-neutral-200 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
            <span className="pointer-events-none absolute left-3 top-2.5 text-neutral-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3 text-xs text-neutral-500">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={item.label}>
              <span className={item.isActive ? "text-neutral-900 font-semibold" : ""}>{item.label}</span>
              {index < breadcrumb.length - 1 && <span>›</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="px-4 py-4">
          {viewLevel === "restaurants" && (
            <RestaurantTable restaurants={filteredRestaurants} onSelect={setSelectedRestaurantId} />
          )}
          {viewLevel === "branches" && selectedRestaurant && (
            <BranchTable
              branches={filteredBranches}
              onSelect={setSelectedBranchId}
              restaurant={selectedRestaurant}
            />
          )}
          {viewLevel === "details" && selectedBranch && (
            <DetailTable details={filteredDetails} branch={selectedBranch} onMarkReceived={handleMarkOrderReceived} />
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-neutral-900">Reminder automation</p>
              <p className="text-sm text-neutral-500">Send notifications to branches when COD dues are overdue.</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>
          </div>
          <div className="space-y-3 text-sm text-neutral-600">
            <p>Last run: <span className="font-semibold text-neutral-900">Today · 08:00</span></p>
            <p>Next run: <span className="font-semibold text-neutral-900">Tomorrow · 08:00</span></p>
            <p>Channels: Email + Owner app push</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleReminder}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            >
              Send reminder now
            </button>
            <button
              type="button"
              onClick={() => toast.success("Reminder settings saved")}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            >
              Edit schedule
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-neutral-900">Audit trail</p>
              <p className="text-sm text-neutral-500">Every time a COD remittance is confirmed or exported.</p>
            </div>
            <button
              type="button"
              onClick={() => handleExport("audit")}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            >
              Export log
            </button>
          </div>
          <ul className="space-y-4">
            {auditTrail.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-neutral-900" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{entry.action}</p>
                  <p className="text-xs text-neutral-500">
                    {entry.actor} · {new Date(entry.timestamp).toLocaleString("vi-VN")}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {entry.target} {entry.amount ? `· ${formatCurrency(entry.amount)}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const FilterSelect = ({ label, value, options, onChange }) => (
  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const RestaurantTable = ({ restaurants, onSelect }) => {
  if (!restaurants.length) {
    return <EmptyState message="No restaurants match the selected filters." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Restaurant</th>
            <th className="px-4 py-3">Total COD sales</th>
            <th className="px-4 py-3">Total fee due</th>
            <th className="px-4 py-3">Total remitted</th>
            <th className="px-4 py-3">Outstanding</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {restaurants.map((restaurant) => (
            <tr key={restaurant.id} className="hover:bg-neutral-50/60">
              <td className="px-4 py-3">
                <p className="font-semibold text-neutral-900">{restaurant.name}</p>
                <p className="text-xs text-neutral-500">Next due: {formatDate(restaurant.nextDueDate)}</p>
              </td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(restaurant.totalCodSales)}</td>
              <td className="px-4 py-3 text-neutral-700">{formatCurrency(restaurant.totalFeeDue)}</td>
              <td className="px-4 py-3 text-emerald-600">{formatCurrency(restaurant.totalRemitted)}</td>
              <td className="px-4 py-3 text-amber-600">{formatCurrency(restaurant.outstanding)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={restaurant.status} />
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSelect(restaurant.id)}
                  className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                >
                  View branches
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const BranchTable = ({ branches, onSelect, restaurant }) => {
  if (!branches.length) {
    return <EmptyState message="No branches in this restaurant match the filters." />;
  }
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 space-y-1">
        <p className="text-sm font-semibold text-neutral-900">{restaurant.name}</p>
        <p className="text-xs text-neutral-500">Branches operating COD collection</p>
      </div>
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Branch / Location</th>
            <th className="px-4 py-3">COD orders</th>
            <th className="px-4 py-3">Gross COD</th>
            <th className="px-4 py-3">Platform fee + VAT</th>
            <th className="px-4 py-3">Remitted</th>
            <th className="px-4 py-3">Remaining</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {branches.map((branch) => (
            <tr key={branch.id} className="hover:bg-neutral-50/60">
              <td className="px-4 py-3">
                <p className="font-semibold text-neutral-900">{branch.name}</p>
                <p className="text-xs text-neutral-500">{branch.location}</p>
              </td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{branch.codOrders}</td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(branch.grossCodCollected)}</td>
              <td className="px-4 py-3 text-neutral-700">{formatCurrency(branch.platformFeeVat)}</td>
              <td className="px-4 py-3 text-emerald-600">{formatCurrency(branch.remittedAmount)}</td>
              <td className="px-4 py-3 text-amber-600">{formatCurrency(branch.remaining)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={branch.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onSelect(branch.id)}
                  className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                >
                  View COD details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DetailTable = ({ details, branch, onMarkReceived }) => {
  if (!details.length) {
    return <EmptyState message="No COD orders for this branch under current filters." />;
  }
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 space-y-1">
        <p className="text-sm font-semibold text-neutral-900">{branch.name}</p>
        <p className="text-xs text-neutral-500">Confirm COD remittances order by order.</p>
      </div>
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Order ID</th>
            <th className="px-4 py-3">Order date</th>
            <th className="px-4 py-3">Gross amount</th>
            <th className="px-4 py-3">Platform fee</th>
            <th className="px-4 py-3">VAT</th>
            <th className="px-4 py-3">Total due</th>
            <th className="px-4 py-3">Remitted</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Proof / Transaction</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {details.map((order) => (
            <tr key={order.id} className="hover:bg-neutral-50/60">
              <td className="px-4 py-3 font-semibold text-neutral-900">{order.id}</td>
              <td className="px-4 py-3 text-neutral-600">{formatDate(order.orderDate)}</td>
              <td className="px-4 py-3 text-neutral-900">{formatCurrency(order.grossAmount)}</td>
              <td className="px-4 py-3 text-neutral-700">{formatCurrency(order.platformFee)}</td>
              <td className="px-4 py-3 text-neutral-700">{formatCurrency(order.vat)}</td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(order.totalDue)}</td>
              <td className="px-4 py-3 text-emerald-600">{formatCurrency(order.remittedAmount)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3 text-neutral-600">{order.proof || "—"}</td>
              <td className="px-4 py-3 text-right space-y-2">
                {order.status !== "Verified" && (
                  <button
                    type="button"
                    onClick={() => onMarkReceived(order)}
                    className="block w-full rounded-full border border-emerald-500 px-4 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                  >
                    Mark as received
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toast.success(order.proof ? `Opened proof ${order.proof}` : "No proof uploaded")}
                  className="block w-full rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300"
                >
                  View proof
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const EmptyState = ({ message }) => (
  <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-10 text-center">
    <p className="text-sm font-semibold text-neutral-900">Nothing to show</p>
    <p className="text-xs text-neutral-500">{message}</p>
  </div>
);

export default CODSettlements;
