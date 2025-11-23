
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    fetchDroneSummary,
    fetchDrones,
} from "../../services/drones";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";
import ownerOrdersService from "../../services/ownerOrders";

const AssignOrders = () => {
    const { restaurantProfile } = useAppContext();
    const ownerRole = restaurantProfile?.role || 'owner_main';
    const ownerId = restaurantProfile?.id || null;
    const canFetchOwnerRestaurants = ownerRole === 'owner_main';

    const [summary, setSummary] = useState({ active: 0, inFlight: 0, completedToday: 0 });
    const [drones, setDrones] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [branchFilter, setBranchFilter] = useState("all");

    const [ownerRestaurants, setOwnerRestaurants] = useState([]);

    const headerCards = [
        { label: "Active Drones", key: "active", detail: "Ready for dispatch", accent: "bg-emerald-100 text-emerald-700" },
        { label: "In Flight", key: "inFlight", detail: "Live assignments", accent: "bg-blue-100 text-blue-700" },
        { label: "Completed Today", key: "completedToday", detail: "Flights logged", accent: "bg-purple-100 text-purple-700" },
    ];

    const branchMetaMap = useMemo(() => {
        const map = new Map();
        const register = (branch) => {
            if (!branch) return;
            const id =
                branch.id ||
                branch.branch_id ||
                branch.branchId ||
                branch.code ||
                branch.slug ||
                null;
            if (!id) return;
            const number = branch.branch_number || branch.branchNumber || branch.code || "";
            const name =
                branch.name ||
                branch.branch_name ||
                (number ? `Branch ${number}` : null) ||
                "Branch";
            map.set(String(id), name);
        };

        const collect = (list) => {
            if (!Array.isArray(list)) return;
            list.forEach((branch) => {
                register(branch);
                if (Array.isArray(branch?.children)) {
                    branch.children.forEach(register);
                }
            });
        };

        collect(restaurantProfile?.branches);
        collect(restaurantProfile?.restaurant?.branches);
        ownerRestaurants.forEach((restaurant) => {
            collect(restaurant?.branches);
        });

        const scopeIds =
            restaurantProfile?.scope?.branchIds ||
            restaurantProfile?.scope?.branch_ids ||
            [];
        if (Array.isArray(scopeIds)) {
            scopeIds.forEach((value, index) => {
                const id = String(value);
                if (!map.has(id)) {
                    map.set(id, `Branch ${index + 1}`);
                }
            });
        }

        return map;
    }, [restaurantProfile, ownerRestaurants]);

    const branchIdsFromDrones = useMemo(() => {
        const ids = new Set();
        drones.forEach((drone) => {
            if (drone?.branch_id) {
                ids.add(String(drone.branch_id));
            }
        });
        return ids;
    }, [drones]);

    const branchOptions = useMemo(() => {
        if (branchMetaMap.size === 0) {
            return [];
        }
        if (branchIdsFromDrones.size) {
            return Array.from(branchIdsFromDrones).map((id) => ({
                id,
                name: branchMetaMap.get(id) || `Branch ${id.slice(0, 4)}`,
            }));
        }
        return Array.from(branchMetaMap.entries()).map(([id, name]) => ({
            id,
            name,
        }));
    }, [branchMetaMap, branchIdsFromDrones]);

    const branchLookup = useMemo(() => {
        if (branchMetaMap.size) return branchMetaMap;
        const map = new Map();
        branchOptions.forEach((option) => map.set(option.id, option.name));
        return map;
    }, [branchMetaMap, branchOptions]);

    const loadData = useCallback(
        async (filterValue = branchFilter) => {
            setLoading(true);
            setError("");
            const params = filterValue !== "all" ? { branchId: filterValue } : {};
            try {
                const [summaryData, droneData] = await Promise.all([
                    fetchDroneSummary(params),
                    fetchDrones(params),
                ]);
                setSummary(summaryData);
                setDrones(droneData);
            } catch (err) {
                console.error("[assign-orders] failed to load drone data", err);
                setError(err?.response?.data?.error || err?.message || "Failed to load drone data");
                setSummary({ active: 0, inFlight: 0, completedToday: 0 });
                setDrones([]);
            } finally {
                setLoading(false);
            }
        },
        [branchFilter],
    );

    useEffect(() => {
        loadData(branchFilter);
    }, [branchFilter, loadData]);

    useEffect(() => {
        if (!ownerId || !canFetchOwnerRestaurants) {
            setOwnerRestaurants([]);
            return;
        }

        let cancelled = false;
        const fetchRestaurants = async () => {
            try {
                const response = await restaurantManagerService.listByOwner(ownerId);
                if (cancelled) return;
                const list = Array.isArray(response?.items)
                    ? response.items
                    : Array.isArray(response)
                    ? response
                    : [];
                setOwnerRestaurants(list);
            } catch (err) {
                if (cancelled) return;
                console.warn("[assign-orders] failed to fetch restaurants", err);
                setOwnerRestaurants([]);
            }
        };
        fetchRestaurants();
        return () => {
            cancelled = true;
        };
    }, [ownerId, canFetchOwnerRestaurants]);

    useEffect(() => {
        if (branchFilter !== "all") {
            const exists = branchOptions.some((branch) => branch.id === branchFilter);
            if (!exists && branchOptions.length) {
                setBranchFilter("all");
            }
        }
    }, [branchOptions, branchFilter]);

    const droneSelectOptions = useMemo(
        () =>
            drones.map((drone) => ({
                id: drone.id,
                label: `${drone.code || "Drone"} · ${drone.battery_level ?? "—"}%`,
                branch_id: drone.branch_id ? String(drone.branch_id) : null,
            })),
        [drones],
    );

    const droneQueue = useMemo(() => drones, [drones]);

    const loadReadyOrders = useCallback(
        async (filterValue = branchFilter) => {
            try {
                const params = {
                    status: "ready",
                    limit: 20,
                };
                if (filterValue && filterValue !== "all") {
                    params.branch_id = filterValue;
                }
                const response = await ownerOrdersService.list(params);
                const raw = Array.isArray(response?.data) ? response.data : [];
                const adapted = raw.map((order) => {
                    const address = order.delivery_snapshot || order.delivery_address || order.shipping_address_snapshot || {};
                    const branchId =
                        order.branch_id ||
                        order.branchId ||
                        order.metadata?.branch_id ||
                        null;
                    const customerName =
                        order.metadata?.customer_name ||
                        order.customer_name ||
                        (order.customer && (order.customer.full_name || order.customer.fullName)) ||
                        null;
                    const customerPhone =
                        order.metadata?.customer_phone ||
                        order.customer_phone ||
                        (order.customer && (order.customer.phone || order.customer.phone_number)) ||
                        null;
                    return {
                        id: order.id,
                        code:
                            order.order_code ||
                            order.short_code ||
                            order.reference_code ||
                            (order.id ? order.id.slice(0, 8) : null),
                        itemsSummary: `${order.items?.length || 0} items · ${order.payment_method || "online"}`,
                        branchId: branchId ? String(branchId) : null,
                        preferredTime:
                            order.timeline_metadata?.find?.((evt) => evt.status === "ready")?.at || null,
                        notes: order.metadata?.notes || order.metadata?.delivery?.notes || null,
                        address,
                        customerName,
                        customerPhone,
                    };
                });
                setOrders(adapted);
            } catch (err) {
                console.warn("[assign-orders] failed to load ready orders", err);
                setOrders([]);
            }
        },
        [branchFilter],
    );

    useEffect(() => {
        loadReadyOrders(branchFilter);
    }, [branchFilter, loadReadyOrders]);

    return (
        <div className="bg-white shadow-sm rounded-2xl p-6 space-y-6">
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Assign Orders to Drones</h1>
                    <p className="text-sm text-slate-600">
                        Balance workloads and dispatch orders to the most optimal drone in seconds.
                    </p>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <select
                        value={branchFilter}
                        onChange={(event) => setBranchFilter(event.target.value)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50"
                    >
                        <option value="all">All branches</option>
                        {branchOptions.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                    <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                        Auto-Assign All
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {headerCards.map((stat) => (
                    <article key={stat.label} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                            {loading ? "…" : summary[stat.key]}
                        </p>
                        <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${stat.accent}`}>
                            {stat.detail}
                        </span>
                    </article>
                ))}
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    {orders.length === 0 ? (
                        <div className="rounded-xl border border-slate-100 bg-white p-6 text-sm text-slate-500">
                            No ready orders waiting for assignment.
                        </div>
                    ) : (
                        orders.map((order) => (
                            <article key={order.id} className="rounded-xl border border-slate-100 bg-white shadow-sm">
                                <header className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                            Order #{order.code || order.id}
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            {order.itemsSummary}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {order.customerName || "Customer"} · {order.customerPhone || "N/A"}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {order.address?.formatted ||
                                                [order.address?.street, order.address?.ward, order.address?.district, order.address?.city]
                                                    .filter(Boolean)
                                                    .join(", ")}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Drone</label>
                                        <select className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60">
                                            <option value="">Select Drone</option>
                                            {droneSelectOptions
                                                .filter((drone) => {
                                                    if (!order.branchId) {
                                                        return true;
                                                    }
                                                    if (!drone.branch_id) {
                                                        return false;
                                                    }
                                                    return String(drone.branch_id) === order.branchId;
                                                })
                                                .map((drone) => (
                                                    <option key={drone.id} value={drone.id}>
                                                        {drone.label}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                </header>

                                <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
                                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery Window</h3>
                                        <p className="mt-2 text-base font-semibold text-slate-800">
                                            {order.preferredTime ? `Preferred at ${order.preferredTime}` : "ASAP"}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Destination:{" "}
                                            {order.address?.formatted ||
                                                [order.address?.street, order.address?.ward, order.address?.district]
                                                    .filter(Boolean)
                                                    .join(", ")}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Notes</h3>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {order.notes || "No additional instructions."}
                                        </p>
                                    </div>
                                </div>

                                <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                    <p className="text-xs text-slate-500">
                                        Automatically suggest the best drone based on battery, proximity, and workload.
                                    </p>
                                    <div className="flex gap-3">
                                        <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                                            Preview Flight Route
                                        </button>
                                        <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">
                                            Assign Drone
                                        </button>
                                    </div>
                                </footer>
                            </article>
                        ))
                    )}
                </div>

                <aside className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Drone Queue</h2>
                        <p className="text-sm text-slate-500">Compare workloads to keep deliveries on time.</p>
                    </div>
                    {error ? <p className="text-sm text-red-500">{error}</p> : null}
                    {loading && !error ? <p className="text-sm text-slate-500">Loading drone status...</p> : null}
                    <ul className="space-y-3 text-sm text-slate-600">
                        {droneQueue.map((drone) => (
                            <li key={drone.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-slate-800">{drone.code || `Drone ${drone.id.slice(0, 4)}`}</p>
                                    <span className="text-xs font-semibold text-emerald-600">
                                        {branchLookup.get(String(drone.branch_id)) || "Any branch"}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Status: {drone.status?.replace(/_/g, " ") || "N/A"}
                                </p>
                                <p className="text-xs text-slate-500">Battery: {drone.battery_level ?? "—"}%</p>
                                <p className="text-xs text-slate-500">Current flights: {drone.flights_today || 0}</p>
                            </li>
                        ))}
                    </ul>
                    <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-700">
                        Tip: Enable auto-assignment during peak hours to dispatch orders based on drone proximity, battery level, and workload.
                    </div>
                </aside>
            </section>
        </div>
    );
};

export default AssignOrders;
