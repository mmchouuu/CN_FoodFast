import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchPayoutOverview,
  fetchRestaurantBranches,
  fetchSettlementOrders,
} from "../../services/adminPayouts";

const PERIOD_FILTERS = [
  { value: "current-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "current-month", label: "This month" },
  { value: "custom", label: "Custom period" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
];

const PAYMENT_FILTERS = [
  { value: "all", label: "All methods" },
  { value: "stripe", label: "Stripe" },
  { value: "momo", label: "MoMo" },
  { value: "visa", label: "Visa" },
];

const DEFAULT_AUDIT_LOGS = [
  {
    id: "audit-1",
    actor: "linh.tran",
    action: "Manual payout approved",
    target: "Green Kitchen • Hanoi Crescent",
    amount: 4150000,
    timestamp: "2025-11-07T09:42:00+07:00",
  },
  {
    id: "audit-2",
    actor: "system.cron",
    action: "Auto payout executed",
    target: "Saigon Street Eats",
    amount: 7800000,
    timestamp: "2025-11-06T02:00:00+07:00",
  },
  {
    id: "audit-3",
    actor: "david.wong",
    action: "Exported payout report",
    target: "Weekly summary (Oct 28 - Nov 3)",
    amount: null,
    timestamp: "2025-11-05T17:15:00+07:00",
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
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
};

const StatusBadge = ({ status }) => {
  const normalized = (status || "").toLowerCase();
  const className = {
    pending: "bg-amber-100 text-amber-800",
    processing: "bg-blue-100 text-blue-800",
    paid: "bg-emerald-100 text-emerald-800",
    "all paid": "bg-emerald-100 text-emerald-800",
    failed: "bg-rose-100 text-rose-800",
  }[normalized] || "bg-neutral-100 text-neutral-700";

  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}>
      {label}
    </span>
  );
};

const PayoutManagement = () => {
  const [filters, setFilters] = useState({
    period: "current-week",
    status: "all",
    payment: "all",
    search: "",
  });
  const [restaurants, setRestaurants] = useState([]);
  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [overview, setOverview] = useState({
    totalOnlineSales: 0,
    pendingPayout: 0,
    restaurantsPending: 0,
    pendingBranches: 0,
  });
  const [periodRange, setPeriodRange] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [autoPayout, setAutoPayout] = useState({ enabled: true, cadence: "weekly" });
  const [auditTrail, setAuditTrail] = useState(DEFAULT_AUDIT_LOGS);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      setIsLoadingRestaurants(true);
      setSelectedRestaurantId(null);
      setSelectedBranchId(null);
      setSelectedSettlement(null);
      setBranches([]);
      setOrders([]);
      try {
        const data = await fetchPayoutOverview({
          period: filters.period,
          status: filters.status !== "all" ? filters.status : undefined,
        });
        if (cancelled) return;
        setRestaurants(data.restaurants);
        setOverview({
          totalOnlineSales: data.summary?.totalOnlineSales ?? 0,
          pendingPayout: data.summary?.pendingPayout ?? 0,
          restaurantsPending: data.summary?.restaurantsPending ?? 0,
          pendingBranches: data.summary?.pendingBranches ?? 0,
        });
        setPeriodRange(data.period || null);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          toast.error(error?.response?.data?.error || "Failed to load payouts overview");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRestaurants(false);
        }
      }
    }
    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [filters.period, filters.status]);

  const loadBranches = async (restaurantId) => {
    if (!restaurantId) return;
    setIsLoadingBranches(true);
    setBranches([]);
    setOrders([]);
    setSelectedBranchId(null);
    setSelectedSettlement(null);
    try {
      const data = await fetchRestaurantBranches(restaurantId, { period: filters.period });
      setBranches(data.branches);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Failed to load branches");
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadOrders = async (branch, restaurantName) => {
    if (!branch?.settlementId) return;
    setIsLoadingOrders(true);
    setOrders([]);
    setSelectedSettlement(null);
    try {
      const data = await fetchSettlementOrders(branch.settlementId);
      setOrders(data.orders);
      setSelectedSettlement({
        ...data.settlement,
        branchName: branch.name,
        branchLocation: branch.location,
        restaurantName: restaurantName || data.settlement?.restaurantName || null,
      });
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Failed to load payout orders");
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null;
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) || null;
  const view = selectedSettlement ? "orders" : selectedRestaurant ? "branches" : "restaurants";

  const searchPlaceholder = useMemo(() => {
    if (view === "branches" && selectedRestaurant) {
      return `Search branches in ${selectedRestaurant.name}`;
    }
    if (view === "orders" && (selectedSettlement || selectedBranch)) {
      return `Search order ID or payment method (${selectedSettlement?.branchName || selectedBranch?.name || "branch"})`;
    }
    return "Search restaurants or brands";
  }, [view, selectedRestaurant, selectedSettlement, selectedBranch]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredRestaurants = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return restaurants.filter((restaurant) => {
      const matchesSearch = !keyword || restaurant.name.toLowerCase().includes(keyword);
      if (!matchesSearch) return false;
      if (filters.status === "all") return true;
      return restaurant.overallStatus === filters.status;
    });
  }, [restaurants, filters.search, filters.status]);

  const filteredBranches = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return branches.filter((branch) => {
      const matchesSearch =
        !keyword ||
        branch.name?.toLowerCase().includes(keyword) ||
        branch.location?.toLowerCase().includes(keyword);
      if (!matchesSearch) return false;
      if (filters.status === "all") return true;
      return branch.status === filters.status;
    });
  }, [branches, filters.search, filters.status]);

  const filteredOrders = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        !keyword ||
        order.id?.toLowerCase().includes(keyword) ||
        order.paymentMethod?.toLowerCase().includes(keyword);
      if (!matchesSearch) return false;
      const statusMatch = filters.status === "all" || order.status === filters.status;
      const paymentMatch = filters.payment === "all" || order.paymentKey === filters.payment;
      return statusMatch && paymentMatch;
    });
  }, [orders, filters.search, filters.status, filters.payment]);

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

  const handleMarkBranchPaid = (branch) => {
    toast.error(`Mark as paid is not available yet for ${branch?.name || "this branch"}`);
  };

  const handleMarkOrderPaid = (order) => {
    toast.error(`Mark as paid is not available yet for ${order?.id || "this order"}`);
  };

  const handleExport = (level) => {
    const label =
      level === "restaurants"
        ? "restaurant summary"
        : level === "branches"
          ? `${selectedRestaurant?.name || "restaurant"} branches`
          : `${selectedSettlement?.branchName || selectedBranch?.name || "branch"} payout details`;
    toast.success(`Exported ${label} report`);
    addAuditEntry({
      action: "Exported payout report",
      target: label,
      amount: null,
    });
  };

  const resetFilters = () => {
    setFilters({
      period: "current-week",
      status: "all",
      payment: "all",
      search: "",
    });
  };

  const handleSelectRestaurant = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    setSelectedBranchId(null);
    setSelectedSettlement(null);
    setFilters((prev) => ({ ...prev, search: "" }));
    loadBranches(restaurantId);
  };

  const handleSelectBranch = (branch) => {
    if (!branch) return;
    setSelectedBranchId(branch.id);
    setFilters((prev) => ({ ...prev, search: "" }));
    loadOrders(branch, selectedRestaurant?.name);
  };

  const handleBack = () => {
    if (selectedSettlement) {
      setSelectedSettlement(null);
      setSelectedBranchId(null);
      setOrders([]);
      setFilters((prev) => ({ ...prev, search: "" }));
      return;
    }
    if (selectedRestaurantId) {
      setSelectedRestaurantId(null);
      setBranches([]);
      setSelectedBranchId(null);
      setFilters((prev) => ({ ...prev, search: "" }));
    }
  };

  const breadcrumb = [
    { label: "Restaurants", isActive: view === "restaurants" },
    ...(selectedRestaurant
      ? [{ label: selectedRestaurant.name, isActive: view === "branches" && !selectedSettlement }]
      : []),
    ...(view === "orders" && (selectedSettlement || selectedBranch)
      ? [
          {
            label: selectedSettlement?.branchName || selectedBranch?.name || "Branch",
            isActive: true,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Payout Management</h1>
          <p className="text-sm text-neutral-600">
            Track online revenues, reconcile fees, and release payouts to restaurant owners.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(selectedRestaurant || selectedBranch) && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={() => handleExport(view)}
            className="inline-flex items-center rounded-full border border-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total online sales"
          value={formatCurrency(overview.totalOnlineSales)}
          subtitle={
            periodRange?.start && periodRange?.end
              ? `${new Date(periodRange.start).toLocaleDateString("vi-VN")} – ${new Date(periodRange.end).toLocaleDateString("vi-VN")}`
              : "Ledger balances"
          }
        />
        <SummaryCard
          title="Pending payout"
          value={formatCurrency(overview.pendingPayout)}
          subtitle={`${overview.pendingBranches} branches awaiting release`}
        />
        <SummaryCard
          title="Restaurants pending"
          value={overview.restaurantsPending}
          subtitle="Need reconciliation"
        />
        <SummaryCard
          title="Auto payouts scheduled"
          value={`${autoPayout.enabled ? "Enabled" : "Paused"}`}
          subtitle={`Run ${autoPayout.cadence}`}
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-neutral-200 p-4 lg:flex-row lg:items-end">
          <div className="flex flex-1 flex-wrap gap-3">
            <FilterSelect
              label="Payout period"
              value={filters.period}
              options={PERIOD_FILTERS}
              onChange={(value) => handleFilterChange("period", value)}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              options={STATUS_FILTERS}
              onChange={(value) => handleFilterChange("status", value)}
            />
            {view === "orders" && (
              <FilterSelect
                label="Payment method"
                value={filters.payment}
                options={PAYMENT_FILTERS}
                onChange={(value) => handleFilterChange("payment", value)}
              />
            )}
          </div>
          <div className="flex w-full gap-3 lg:w-auto">
            <div className="relative flex-1">
              <input
                type="search"
                value={filters.search}
                onChange={(event) => handleFilterChange("search", event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-neutral-200 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
              <span className="pointer-events-none absolute left-3 top-2.5 text-neutral-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3 text-xs text-neutral-500">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              <span className={item.isActive ? "text-neutral-900 font-semibold" : ""}>{item.label}</span>
              {index < breadcrumb.length - 1 && <span>›</span>}
            </React.Fragment>
          ))}
        </div>

        <div className="px-4 py-4">
          {view === "restaurants" && (
            <RestaurantTable
              restaurants={filteredRestaurants}
              onSelect={handleSelectRestaurant}
              loading={isLoadingRestaurants}
            />
          )}
          {view === "branches" && (
            <BranchTable
              restaurantName={selectedRestaurant?.name}
              branches={filteredBranches}
              onSelect={handleSelectBranch}
              onMarkPaid={handleMarkBranchPaid}
              loading={isLoadingBranches}
            />
          )}
          {view === "orders" && (
            <OrderTable
              settlement={selectedSettlement}
              orders={filteredOrders}
              onMarkPaid={handleMarkOrderPaid}
              loading={isLoadingOrders}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-neutral-900">Auto payout job</p>
              <p className="text-sm text-neutral-500">Cron that reconciles all paid orders and triggers Stripe/MoMo payouts.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAutoPayout((prev) => ({ ...prev, enabled: !prev.enabled }));
                toast.success(`Auto payout ${autoPayout.enabled ? "paused" : "enabled"}`);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                autoPayout.enabled ? "bg-emerald-600 text-white" : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {autoPayout.enabled ? "Enabled" : "Paused"}
            </button>
          </div>
          <div className="grid gap-3 text-sm text-neutral-600">
            <p>Next run: <span className="font-semibold text-neutral-900">Sunday · 02:00 AM</span></p>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Cadence</label>
            <SelectControl
              value={autoPayout.cadence}
              onChange={(event) => setAutoPayout((prev) => ({ ...prev, cadence: event.target.value }))}
              options={[
                { value: "weekly", label: "Weekly (recommended)" },
                { value: "bi-weekly", label: "Every 2 weeks" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <button
              type="button"
              onClick={() => toast.success("Test payout simulation queued")}
              className="mt-3 inline-flex justify-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-400"
            >
              Run simulation
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-neutral-900">Audit trail</p>
              <p className="text-sm text-neutral-500">Who touched payouts, when, and for how much.</p>
            </div>
            <button
              type="button"
              onClick={() => toast.success("Audit log exported")}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-300"
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

const SummaryCard = ({ title, value, subtitle }) => (
  <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-neutral-500">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
    <p className="text-xs text-neutral-500">{subtitle}</p>
  </div>
);

const FilterSelect = ({ label, value, options, onChange }) => (
  <label className="flex flex-col text-xs font-semibold text-neutral-500">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
    >
      {options.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const SelectControl = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
  >
    {options.map((option) => (
      <option value={option.value} key={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const RestaurantTable = ({ restaurants, onSelect, loading }) => {
  if (loading) {
    return <EmptyState message="Loading restaurants..." isLoading />;
  }
  if (!restaurants.length) {
    return <EmptyState message="No restaurants awaiting payout for the selected filters." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Restaurant name</th>
            <th className="px-4 py-3">Total online sales</th>
            <th className="px-4 py-3">Total pending payout</th>
            <th className="px-4 py-3">Last payout</th>
            <th className="px-4 py-3">Overall status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {restaurants.map((restaurant) => (
            <tr key={restaurant.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-neutral-900">{restaurant.name}</p>
                <p className="text-xs text-neutral-500">{restaurant.branchCount} branches</p>
              </td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(restaurant.totalOnlineSales)}</td>
              <td className="px-4 py-3 text-amber-600">{formatCurrency(restaurant.totalPendingPayout)}</td>
              <td className="px-4 py-3 text-neutral-600">{formatDate(restaurant.lastPayoutDate)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={restaurant.overallStatus} />
              </td>
              <td className="px-4 py-3 text-right">
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

const BranchTable = ({ restaurantName, branches, onSelect, onMarkPaid, loading }) => {
  if (loading) {
    return <EmptyState message="Loading branches..." isLoading />;
  }
  if (!branches.length) {
    return <EmptyState message="No branches matching the current filters." />;
  }
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex flex-col gap-2">
        <p className="text-sm font-semibold text-neutral-900">{restaurantName || "Restaurant branches"}</p>
        <p className="text-xs text-neutral-500">
          Showing {branches.length} branch{branches.length > 1 ? "es" : ""} with online orders awaiting reconciliation.
        </p>
      </div>
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Branch / Location</th>
            <th className="px-4 py-3">Online orders</th>
            <th className="px-4 py-3">Total sales</th>
            <th className="px-4 py-3">Pending payout</th>
            <th className="px-4 py-3">Net amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {branches.map((branch) => (
            <tr key={branch.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-neutral-900">{branch.name}</p>
                <p className="text-xs text-neutral-500">{branch.location || "Location unavailable"}</p>
              </td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{branch.onlineOrders}</td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(branch.totalSales)}</td>
              <td className="px-4 py-3 text-amber-600">{formatCurrency(branch.pendingPayout)}</td>
              <td className="px-4 py-3 text-neutral-900">{formatCurrency(branch.netAmount)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={branch.status} />
              </td>
              <td className="px-4 py-3 text-right space-y-2">
                <button
                  type="button"
                  onClick={() => onSelect(branch)}
                  className="block w-full rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                >
                  View payout details
                </button>
                {branch.status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => onMarkPaid(branch)}
                    className="block w-full rounded-full border border-emerald-500 px-4 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                  >
                    Mark as paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const OrderTable = ({ settlement, orders, onMarkPaid, loading }) => {
  if (loading) {
    return <EmptyState message="Loading payout details..." isLoading />;
  }
  if (!orders.length) {
    return <EmptyState message="No payout detail for the selected filters." />;
  }
  const periodLabel =
    settlement?.periodStart && settlement?.periodEnd
      ? `${formatDate(settlement.periodStart)} – ${formatDate(settlement.periodEnd)}`
      : "Current payout window";
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-900">
          {settlement?.branchName || "Branch payout"}
        </p>
        <p className="text-xs text-neutral-500">
          Orders scheduled for {periodLabel}. Confirm fees and mark as paid.
        </p>
      </div>
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Order ID</th>
            <th className="px-4 py-3">Order date</th>
            <th className="px-4 py-3">Total sales</th>
            <th className="px-4 py-3">VAT</th>
            <th className="px-4 py-3">Delivery fee</th>
            <th className="px-4 py-3">Net payout</th>
            <th className="px-4 py-3">Payment method</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3 font-semibold text-neutral-900">{order.id}</td>
              <td className="px-4 py-3 text-neutral-600">{formatDateTime(order.orderDate)}</td>
              <td className="px-4 py-3">{formatCurrency(order.totalSales)}</td>
              <td className="px-4 py-3">{formatCurrency(order.vat)}</td>
              <td className="px-4 py-3">{formatCurrency(order.deliveryFee)}</td>
              <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(order.netPayout)}</td>
              <td className="px-4 py-3">{order.paymentMethod}</td>
              <td className="px-4 py-3">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3 text-right space-y-2">
                {order.status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => onMarkPaid(order)}
                    className="block w-full rounded-full border border-emerald-500 px-4 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                  >
                    Mark as paid
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toast.success(`Exported detail for ${order.id}`)}
                  className="block w-full rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300"
                >
                  Export detail
                </button>
                <button
                  type="button"
                  onClick={() => toast.success(`Proof attached for ${order.id}`)}
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

const EmptyState = ({ message, isLoading = false }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-10 text-center">
    <p className="text-sm font-semibold text-neutral-900">
      {isLoading ? "Loading data" : "Nothing to show"}
    </p>
    <p className="text-xs text-neutral-500">{message}</p>
  </div>
);

export default PayoutManagement;
