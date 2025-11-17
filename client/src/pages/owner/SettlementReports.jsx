import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ownerSettlementsService from "../../services/ownerSettlements";
import restaurantManagerService from "../../services/restaurantManager";
import { useAppContext } from "../../context/AppContext";

const DATE_FILTERS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-90-days", label: "Last 90 days" },
  { value: "custom", label: "Custom" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
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
  } catch (error) {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch (error) {
    return value;
  }
};

const StatusBadge = ({ status }) => {
  const normalized = (status || "").toLowerCase();
  const styles = {
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[normalized] || "bg-neutral-100 text-neutral-700"}`}>
      {status || "Unknown"}
    </span>
  );
};

const resolveDateRangeLabel = (settlement) => {
  if (!settlement?.periodStart || !settlement?.periodEnd) return null;
  return `${formatDate(settlement.periodStart)} – ${formatDate(settlement.periodEnd)}`;
};

const SettlementReports = () => {
  const { restaurantProfile } = useAppContext();
  const [filters, setFilters] = useState({
    branchId: "all",
    dateRange: "this-month",
    status: "all",
    search: "",
  });
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [summary, setSummary] = useState({ totalOnlineSales: 0, totalVat: 0, netEarnings: 0, totalOrders: 0 });
  const [settlements, setSettlements] = useState([]);
  const [branches, setBranches] = useState([]);
  const [restaurantContext, setRestaurantContext] = useState({ id: null, name: null });
  const [ownerRestaurants, setOwnerRestaurants] = useState([]);
  const [period, setPeriod] = useState({ start: null, end: null });
  const [isLoading, setIsLoading] = useState(false);
  const [ordersModal, setOrdersModal] = useState({ isOpen: false, isLoading: false, settlement: null, orders: [] });

  const branchOptions = useMemo(() => {
    return [
      { value: "all", label: "All branches" },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name, location: branch.location })),
    ];
  }, [branches]);

  useEffect(() => {
    const ownerId = restaurantProfile?.id;
    if (!ownerId) {
      setOwnerRestaurants([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await restaurantManagerService.listByOwner(ownerId);
        if (cancelled) return;
        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
            ? response
            : [];
        setOwnerRestaurants(items);
        if (!restaurantContext.id && items.length) {
          const primaryRestaurant = items[0];
          setRestaurantContext({
            id: primaryRestaurant.id,
            name:
              primaryRestaurant.name ||
              primaryRestaurant.legalName ||
              primaryRestaurant.displayName ||
              restaurantProfile?.restaurantName ||
              restaurantProfile?.profile?.legal_name ||
              "Restaurant",
          });
        }
      } catch (error) {
        console.error("[owner-settlements] failed to load restaurants", error);
        if (!restaurantContext.id) {
          toast.error("Unable to resolve restaurant scope.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantProfile, restaurantContext.id, setRestaurantContext]);

  useEffect(() => {
    const currentRestaurant =
      ownerRestaurants.find(
        (restaurant) => String(restaurant.id) === String(restaurantContext.id),
      ) || null;
    const branchList = Array.isArray(currentRestaurant?.branches)
      ? currentRestaurant.branches
      : [];
    setBranches(
      branchList.map((branch) => ({
        id: branch.id,
        name: branch.name || branch.branch_name || "Branch",
        location:
          branch.location ||
          branch.address ||
          branch.fullAddress ||
          branch.address_line ||
          "",
      })),
    );
    if (
      filters.branchId !== "all" &&
      !branchList.some((branch) => String(branch.id) === String(filters.branchId))
    ) {
      setFilters((prev) => ({ ...prev, branchId: "all" }));
    }
  }, [ownerRestaurants, restaurantContext.id, filters.branchId]);

  useEffect(() => {
    const derivedId =
      restaurantProfile?.profile?.restaurant_id ||
      restaurantProfile?.profile?.restaurantId ||
      restaurantProfile?.restaurant_id ||
      restaurantProfile?.restaurantId ||
      null;
    if (derivedId && restaurantContext.id !== derivedId && !ownerRestaurants.length) {
      setRestaurantContext((prev) => ({
        id: derivedId,
        name:
          restaurantProfile?.restaurantName ||
          restaurantProfile?.restaurant_name ||
          restaurantProfile?.profile?.legal_name ||
          prev.name,
      }));
    }
  }, [restaurantProfile, restaurantContext.id, ownerRestaurants.length]);

  const fetchSettlements = async () => {
    if (!restaurantContext.id) {
      return;
    }
    setIsLoading(true);
    try {
      const params = {
        restaurant_id: restaurantContext.id || undefined,
      };
      if (filters.branchId !== "all") {
        params.branch_id = filters.branchId;
      }
      if (filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.search.trim()) {
        params.search = filters.search.trim();
      }
      if (filters.dateRange === "custom") {
        if (customRange.start) params.start_date = customRange.start;
        if (customRange.end) params.end_date = customRange.end;
      } else if (filters.dateRange === "last-90-days") {
        params.start_date = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        params.end_date = new Date().toISOString().slice(0, 10);
      } else {
        params.period = filters.dateRange;
      }

      const data = await ownerSettlementsService.fetchSettlements(params);
      setRestaurantContext((prev) => ({ id: data.restaurantId || prev.id, name: data.restaurantName || prev.name }));
      setSummary({
        totalOnlineSales: data.summary?.totalOnlineSales || 0,
        totalVat: data.summary?.totalVat || 0,
        netEarnings: data.summary?.netEarnings || 0,
        totalOrders: data.summary?.totalOrders || 0,
      });
      setSettlements(data.settlements || []);
      setPeriod(data.period || { start: null, end: null });
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Failed to load settlements");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurantContext.id) {
      return;
    }
    fetchSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId, filters.dateRange, filters.status, filters.search, customRange.start, customRange.end, restaurantContext.id]);

  const handleReset = () => {
    setFilters({ branchId: "all", dateRange: "this-month", status: "all", search: "" });
    setCustomRange({ start: "", end: "" });
  };

  const handleViewOrders = async (settlement) => {
    setOrdersModal({ isOpen: true, isLoading: true, settlement, orders: [] });
    try {
      const params = { restaurant_id: restaurantContext.id || undefined };
      const data = await ownerSettlementsService.fetchSettlementOrders(settlement.settlementId, params);
      setOrdersModal({
        isOpen: true,
        isLoading: false,
        settlement: {
          ...settlement,
          ...(data.settlement || {}),
        },
        orders: data.orders || [],
      });
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Failed to load payout details");
      setOrdersModal({ isOpen: false, isLoading: false, settlement: null, orders: [] });
    }
  };

  const filteredSettlements = useMemo(() => {
    if (!filters.search.trim()) return settlements;
    const keyword = filters.search.trim().toLowerCase();
    return settlements.filter((settlement) => {
      return (
        settlement.payoutId?.toLowerCase().includes(keyword) ||
        settlement.payoutCode?.toLowerCase().includes(keyword) ||
        settlement.cycleLabel?.toLowerCase().includes(keyword)
      );
    });
  }, [settlements, filters.search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Settlement center</p>
          <h1 className="text-2xl font-bold text-slate-900">Settlement Reports</h1>
          <p className="text-sm text-slate-500">Review online payouts FoodFast has collected and remitted for your branches.</p>
        </div>
        <div className="text-sm text-slate-500">Scope: {restaurantContext.name || 'All restaurants'}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total online sales"
          value={formatCurrency(summary.totalOnlineSales)}
          helper={`Across ${summary.totalOrders || 0} orders`}
        />
        <SummaryCard label="Total VAT" value={formatCurrency(summary.totalVat)} helper="Tax withheld per payout cycle" />
        <SummaryCard label="Net earnings" value={formatCurrency(summary.netEarnings)} helper="Transfer amount after all fees" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <FilterSelect
            label="Branch"
            value={filters.branchId}
            options={branchOptions}
            onChange={(value) => setFilters((prev) => ({ ...prev, branchId: value }))}
          />
          <FilterSelect
            label="Date range"
            value={filters.dateRange}
            options={DATE_FILTERS}
            onChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
          />
          {filters.dateRange === "custom" && (
            <div className="flex w-full flex-col gap-2 text-xs text-slate-500 md:flex-row md:items-end">
              <label className="flex flex-1 flex-col">
                Start date
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(event) => setCustomRange((prev) => ({ ...prev, start: event.target.value }))}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-1 flex-col">
                End date
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(event) => setCustomRange((prev) => ({ ...prev, end: event.target.value }))}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </label>
            </div>
          )}
          <FilterSelect
            label="Status"
            value={filters.status}
            options={STATUS_FILTERS}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          />
          <label className="flex w-full flex-col text-xs font-semibold text-slate-500">
            Search payout
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Payout ID or cycle"
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Reset filters
            </button>
            <button
              type="button"
              onClick={() => toast.success('Download scheduled')}
              className="rounded-lg border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Settlement table</p>
            <p className="text-xs text-slate-500">Reference each payout cycle, fees withheld, and transfer status.</p>
          </div>
          <p className="text-xs text-slate-400">
            {period?.end ? `Updated ${formatDate(period.end)}` : "Updated automatically"}
          </p>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Loading settlements…</div>
        ) : filteredSettlements.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No payout cycles match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Payout ID / Cycle</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Total orders</th>
                  <th className="px-5 py-3">Gross sales</th>
                  <th className="px-5 py-3">VAT</th>
                  <th className="px-5 py-3">Delivery fee</th>
                  <th className="px-5 py-3">Net amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payout date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSettlements.map((settlement) => (
                  <tr key={settlement.settlementId} className="hover:bg-slate-50">
                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-semibold text-slate-900">{settlement.payoutCode || settlement.payoutId}</p>
                      <p className="text-xs text-slate-500">{settlement.cycleLabel || resolveDateRangeLabel(settlement)}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-slate-900">{settlement.branchName || 'Branch'}</p>
                      <p className="text-xs text-slate-500">{settlement.branchLocation || settlement.branchId}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{settlement.totalOrders}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(settlement.grossSales)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatCurrency(settlement.vat)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatCurrency(settlement.deliveryFeeTotal)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-600">{formatCurrency(settlement.netAmount)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={settlement.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(settlement.payoutDate)}</td>
                    <td className="px-5 py-4 text-right space-y-2">
                      <button
                        type="button"
                        onClick={() => handleViewOrders(settlement)}
                        className="block w-full rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        View orders
                      </button>
                      <button
                        type="button"
                        onClick={() => toast.success('PDF download scheduled')}
                        className="block w-full rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => toast.success('Proof ready')}
                        className="block w-full rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        View proof
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ordersModal.isOpen && (
        <OrdersModal
          isLoading={ordersModal.isLoading}
          settlement={ordersModal.settlement}
          orders={ordersModal.orders}
          onClose={() => setOrdersModal({ isOpen: false, isLoading: false, settlement: null, orders: [] })}
        />
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500">{helper}</p>
  </div>
);

const FilterSelect = ({ label, value, options, onChange }) => (
  <label className="flex w-full flex-col text-xs font-semibold text-slate-500">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const OrdersModal = ({ isLoading, settlement, orders, onClose }) => {
  if (!settlement) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">{settlement.payoutCode || settlement.payoutId}</p>
            <h2 className="text-xl font-bold text-slate-900">{settlement.cycleLabel || resolveDateRangeLabel(settlement)}</h2>
            <p className="text-sm text-slate-500">
              {settlement.branchName || 'Branch'} · {resolveDateRangeLabel(settlement)} · {settlement.totalOrders || orders.length} orders
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500">Net received</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(settlement.netAmount)}</p>
          </div>
        </div>
        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">Loading payout details…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Order date</th>
                  <th className="px-6 py-3">Branch</th>
                  <th className="px-6 py-3">Total sales</th>
                  <th className="px-6 py-3">VAT</th>
                  <th className="px-6 py-3">Delivery fee</th>
                  <th className="px-6 py-3">Net received</th>
                  <th className="px-6 py-3">Payment</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 font-semibold text-slate-900">{order.id}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDateTime(order.orderDate)}</td>
                    <td className="px-6 py-4 text-slate-600">{order.branchName || settlement.branchName}</td>
                    <td className="px-6 py-4">{formatCurrency(order.totalSales)}</td>
                    <td className="px-6 py-4">{formatCurrency(order.vat)}</td>
                    <td className="px-6 py-4">{formatCurrency(order.deliveryFee)}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">{formatCurrency(order.netPayout)}</td>
                    <td className="px-6 py-4">{order.paymentMethod?.label || order.paymentMethod || 'Online'}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => toast.success('Export scheduled')}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
          >
            Export detail
          </button>
          <button
            type="button"
            onClick={() => toast.success('Proof ready')}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
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
  );
};

export default SettlementReports;
