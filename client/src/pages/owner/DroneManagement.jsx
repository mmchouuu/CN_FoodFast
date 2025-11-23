import React, { useEffect, useMemo, useState } from "react";
import {
    fetchDroneSummary,
    fetchDrones,
    createDrone,
    fetchDroneLogs,
} from "../../services/drones";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";

const fallbackBranches = [
    { id: "branch-01", name: "Downtown Hub" },
    { id: "branch-02", name: "Airport Logistics" },
    { id: "branch-03", name: "District 7 Fulfillment" },
];

const DroneManagement = () => {
    const { restaurantProfile } = useAppContext();
    const ownerRole = restaurantProfile?.role || 'owner_main';
    const ownerId = restaurantProfile?.id || null;
    const canFetchOwnerRestaurants = ownerRole === 'owner_main';
    const [summary, setSummary] = useState({ active: 0, inFlight: 0, completedToday: 0 });
    const [fleet, setFleet] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [branchFilter, setBranchFilter] = useState("all");

    const [showForm, setShowForm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [formData, setFormData] = useState({
        branchId: "",
        code: "",
        model: "",
        maxPayload: "",
        batteryLevel: "",
    });

    const [ownerRestaurants, setOwnerRestaurants] = useState([]);
    const [logsState, setLogsState] = useState({
        open: false,
        drone: null,
        items: [],
        loading: false,
        error: "",
    });

    const branchMetaMap = useMemo(() => {
        const map = new Map();
        const registerBranch = (branch) => {
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

        const fromList = (list) => {
            if (!Array.isArray(list)) return;
            list.forEach((branch) => {
                registerBranch(branch);
                if (Array.isArray(branch?.children)) {
                    branch.children.forEach(registerBranch);
                }
            });
        };

        fromList(restaurantProfile?.branches);
        fromList(restaurantProfile?.restaurant?.branches);
        ownerRestaurants.forEach((restaurant) => {
            fromList(restaurant?.branches);
        });

        const scopeIds =
            restaurantProfile?.scope?.branchIds ||
            restaurantProfile?.scope?.branch_ids ||
            [];
        if (Array.isArray(scopeIds)) {
            scopeIds.forEach((branchId, index) => {
                const id = String(branchId);
                if (!map.has(id)) {
                    map.set(id, `Branch ${index + 1}`);
                }
            });
        }

        return map;
    }, [restaurantProfile, ownerRestaurants]);

    const allBranchOptions = useMemo(() => {
        if (branchMetaMap.size) {
            return Array.from(branchMetaMap.entries()).map(([id, name]) => ({
                id,
                name,
            }));
        }
        return fallbackBranches;
    }, [branchMetaMap]);

    const branchIdsFromFleet = useMemo(() => {
        const ids = new Set();
        fleet.forEach((drone) => {
            if (!drone?.branch_id) return;
            ids.add(String(drone.branch_id));
        });
        return ids;
    }, [fleet]);

    const branchOptions = useMemo(() => {
        if (branchIdsFromFleet.size) {
            return Array.from(branchIdsFromFleet).map((id) => ({
                id,
                name:
                    branchMetaMap.get(id) ||
                    `Branch ${id.length > 4 ? id.slice(0, 4) : id}`,
            }));
        }
        return allBranchOptions;
    }, [branchIdsFromFleet, branchMetaMap, allBranchOptions]);

    const branchLookup = useMemo(() => {
        if (branchMetaMap.size) {
            return branchMetaMap;
        }
        const map = new Map();
        branchOptions.forEach((branch) => {
            map.set(branch.id, branch.name);
        });
        return map;
    }, [branchMetaMap, branchOptions]);

    const headerCards = [
        { label: "Active Drones", key: "active", accent: "bg-emerald-100 text-emerald-700" },
        { label: "In Flight", key: "inFlight", accent: "bg-blue-100 text-blue-700" },
        { label: "Completed Today", key: "completedToday", accent: "bg-purple-100 text-purple-700" },
    ];

    const loadData = async (filterValue = branchFilter) => {
        setLoading(true);
        setError("");
        const params = filterValue && filterValue !== "all" ? { branchId: filterValue } : {};
        try {
            const [summaryData, droneData] = await Promise.all([
                fetchDroneSummary(params),
                fetchDrones(params),
            ]);
            setSummary(summaryData);
            setFleet(droneData);
        } catch (err) {
            setError(err?.response?.data?.error || "Failed to load drone data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(branchFilter);
    }, [branchFilter]);

    useEffect(() => {
        if (!ownerId || !canFetchOwnerRestaurants) {
            setOwnerRestaurants([]);
            return;
        }
        let cancelled = false;

        const run = async () => {
            try {
                const response = await restaurantManagerService.listByOwner(ownerId);
                if (cancelled) return;
                const items = Array.isArray(response?.items)
                    ? response.items
                    : Array.isArray(response)
                    ? response
                    : [];
                setOwnerRestaurants(items);
            } catch (error) {
                if (cancelled) return;
                console.warn('[drone-management] failed to load owner restaurants', error);
                setOwnerRestaurants([]);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [ownerId, canFetchOwnerRestaurants]);

    useEffect(() => {
        if (branchFilter !== "all") {
            const exists = branchOptions.some((option) => option.id === branchFilter);
            if (!exists) {
                setBranchFilter("all");
            }
        }
    }, [branchOptions, branchFilter]);

    const resetForm = () => {
        setFormData({
            branchId: "",
            code: "",
            model: "",
            maxPayload: "",
            batteryLevel: "",
        });
        setFormError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");
        setIsSaving(true);
        try {
            await createDrone({
                branch_id: formData.branchId || null,
                code: formData.code,
                model: formData.model,
                max_payload: formData.maxPayload ? Number(formData.maxPayload) : null,
                battery_level: formData.batteryLevel ? Number(formData.batteryLevel) : 100,
            });
            setShowForm(false);
            resetForm();
            await loadData();
        } catch (err) {
            setFormError(err?.response?.data?.error || err.message || "Failed to add drone");
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewLogs = async (drone) => {
        setLogsState({ open: true, drone, items: [], loading: true, error: "" });
        try {
            const logs = await fetchDroneLogs(drone.id);
            setLogsState((prev) => ({ ...prev, loading: false, items: logs }));
        } catch (err) {
            setLogsState((prev) => ({
                ...prev,
                loading: false,
                error: err?.response?.data?.error || "Failed to load flight logs",
            }));
        }
    };

    return (
        <div className="space-y-6">
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                                    Add new drone
                                </p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">Register a drone</h3>
                                <p className="text-sm text-slate-500">
                                    Assign the drone to a branch and capture its capabilities.
                                </p>
                            </div>
                            <button
                                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700"
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                                aria-label="Close new drone form"
                            >
                                ✕
                            </button>
                        </div>

                        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Branch
                                    <select
                                        required
                                        value={formData.branchId}
                                        onChange={(event) =>
                                            setFormData((prev) => ({ ...prev, branchId: event.target.value }))
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50"
                                    >
                                        <option value="">Select branch</option>
                                    {allBranchOptions.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Drone code
                                    <input
                                        required
                                        value={formData.code}
                                        onChange={(event) =>
                                            setFormData((prev) => ({ ...prev, code: event.target.value }))
                                        }
                                        placeholder="DRONE-05"
                                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Model
                                    <input
                                        required
                                        value={formData.model}
                                        onChange={(event) =>
                                            setFormData((prev) => ({ ...prev, model: event.target.value }))
                                        }
                                        placeholder="DJI Inspire 3"
                                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Max payload (kg)
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={formData.maxPayload}
                                        onChange={(event) =>
                                            setFormData((prev) => ({ ...prev, maxPayload: event.target.value }))
                                        }
                                        placeholder="2.5"
                                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50"
                                    />
                                </label>
                            </div>

                            <label className="text-sm font-semibold text-slate-700">
                                Battery level (%)
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.batteryLevel}
                                    onChange={(event) =>
                                        setFormData((prev) => ({ ...prev, batteryLevel: event.target.value }))
                                    }
                                    placeholder="100"
                                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50"
                                />
                            </label>

                            {formError ? (
                                <p className="text-sm font-semibold text-red-500">{formError}</p>
                            ) : null}

                            <div className="flex items-center justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false);
                                        resetForm();
                                    }}
                                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition ${isSaving ? "bg-emerald-300" : "bg-emerald-500 hover:bg-emerald-600"}`}
                                >
                                    {isSaving ? "Saving..." : "Save drone"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {logsState.open && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Flight logs</p>
                                <h3 className="text-2xl font-bold text-slate-900">
                                    {logsState.drone?.code || "Drone"}
                                </h3>
                                <p className="text-sm text-slate-500">Most recent telemetry entries.</p>
                            </div>
                            <button
                                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700"
                                onClick={() => setLogsState({ open: false, drone: null, items: [], loading: false, error: "" })}
                                aria-label="Close logs"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50">
                            {logsState.loading ? (
                                <p className="p-4 text-sm text-slate-500">Loading logs...</p>
                            ) : logsState.error ? (
                                <p className="p-4 text-sm text-red-500">{logsState.error}</p>
                            ) : logsState.items.length === 0 ? (
                                <p className="p-4 text-sm text-slate-500">No logs recorded yet.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100 text-sm text-slate-600">
                                    {logsState.items.map((log) => (
                                        <li key={log.id} className="px-4 py-3 space-y-1">
                                            <p className="text-xs uppercase text-slate-400">
                                                {new Date(log.created_at).toLocaleString()}
                                            </p>
                                            <div className="flex flex-wrap gap-4">
                                                <span>Battery: <strong>{log.battery_level ?? "—"}%</strong></span>
                                                {log.speed !== null && log.speed !== undefined ? (
                                                    <span>Speed: <strong>{log.speed} m/s</strong></span>
                                                ) : null}
                                                {log.position?.formatted ? (
                                                    <span>Pos: <strong>{log.position.formatted}</strong></span>
                                                ) : null}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <header className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Drone Management</p>
                        <h1 className="text-3xl font-bold text-slate-900 mt-2">Manage Drone Fleet & Assignments</h1>
                        <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                            Monitor drone availability, battery performance, and flight assignments. Keep customers updated with reliable aerial delivery.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition">
                            Show Active
                        </button>
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
                        <button className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition">
                            Export Fleet
                        </button>
                    </div>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {headerCards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? "…" : summary[card.key]}</p>
                        <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${card.accent}`}>
                            {card.key === "active"
                                ? "Ready for dispatch"
                                : card.key === "inFlight"
                                    ? "Live assignments"
                                    : "Flights logged"}
                        </span>
                    </div>
                ))}
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <header className="px-6 py-5 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Active Drones</p>
                        <h2 className="text-xl font-semibold text-slate-900 mt-1">Fleet overview</h2>
                        <p className="text-sm text-slate-500">
                            Manage availability, performance, and fleet capacity
                            {branchFilter !== "all"
                                ? ` · ${branchOptions.find((b) => b.id === branchFilter)?.name || "Selected branch"}`
                                : ""}.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                            Schedule Maintenance
                        </button>
                        <button
                            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition"
                            onClick={() => setShowForm(true)}
                        >
                            Add new drone
                        </button>
                    </div>
                </header>

                {error ? (
                    <div className="px-6 py-3 text-sm text-red-500">{error}</div>
                ) : null}
                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <p className="px-6 py-6 text-sm text-slate-500">Loading drones...</p>
                    ) : fleet.length === 0 ? (
                        <p className="px-6 py-6 text-sm text-slate-500">No drones registered yet.</p>
                    ) : (
                        fleet.map((drone) => (
                            <article key={drone.id} className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm uppercase text-slate-500">{drone.code}</p>
                                    <h3 className="text-lg font-semibold text-slate-900">{drone.model || "Unnamed model"}</h3>
                                    <p className="text-sm text-slate-500">
                                        Max Payload: {drone.max_payload !== null && drone.max_payload !== undefined
                                            ? `${Number(drone.max_payload).toFixed(1)} kg`
                                            : "—"}
                                    </p>
                                    {drone.branch_id ? (
                                        <p className="text-xs text-slate-400">
                                            Assigned to {branchLookup.get(drone.branch_id) || 'Branch'}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <InfoPill label="Status" value={drone.status} />
                                    <InfoPill label="Battery" value={`${drone.battery_level ?? "—"}%`} />
                                    <InfoPill label="Flights Today" value={`${drone.flights_today || 0}`} />
                                </div>
                                <div className="flex gap-3">
                                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                                        Edit
                                    </button>
                                    <button
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                                        onClick={() => handleViewLogs(drone)}
                                    >
                                        View Flight Logs
                                    </button>
                                    <button className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition">
                                        Remove
                                    </button>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

const statusColors = {
    idle: "bg-amber-100 text-amber-700",
    flying: "bg-blue-100 text-blue-700",
    charging: "bg-orange-100 text-orange-700",
    assigned: "bg-emerald-100 text-emerald-700",
    offline: "bg-slate-200 text-slate-500",
};

const InfoPill = ({ label, value }) => {
    const normalisedValue = typeof value === "string" ? value.toLowerCase() : value;
    const statusClass = label === "Status"
        ? statusColors[normalisedValue] ?? "bg-slate-100 text-slate-700"
        : null;
    return (
        <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs min-w-[120px]">
            <span className="text-slate-500 uppercase">{label}</span>
            {statusClass ? (
                <span className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                    {typeof value === "string"
                        ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
                        : value}
                </span>
            ) : (
                <span className="text-slate-900 font-semibold">{value}</span>
            )}
        </div>
    );
};

export default DroneManagement;
