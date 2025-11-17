import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const ROLE_LABELS = {
  owner_main: "Owner Main",
  owner: "Owner (Branch)",
  manager: "Manager",
  staff: "Staff",
};

const ROLE_CAPABILITIES = {
  owner_main: [
    "Create / deactivate branches",
    "Approve branch owners & managers",
    "Full financial visibility",
    "Control global menu + pricing",
  ],
  owner: [
    "Manage menu for assigned branch",
    "Approve branch-level staff",
    "Access financial exports for the branch",
    "View all branch orders",
  ],
  manager: [
    "Manage menus and availability",
    "Assign delivery staff",
    "Monitor active orders",
    "See limited branch financials",
  ],
  staff: [
    "Acknowledge & prepare orders",
    "Update delivery notes",
    "Chat with customers",
  ],
};

const ROLE_COLORS = {
  owner_main: "bg-orange-50 text-orange-700 border-orange-200",
  owner: "bg-emerald-50 text-emerald-700 border-emerald-200",
  manager: "bg-sky-50 text-sky-700 border-sky-200",
  staff: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
};

const normalizeBranch = (branch) => {
  if (!branch) return null;
  return {
    id: branch.id || branch.branchId || branch.uuid || branch._id || null,
    name:
      branch.name ||
      branch.branchName ||
      branch.label ||
      branch.street ||
      "Unnamed branch",
    isPrimary:
      branch.isPrimary !== undefined
        ? Boolean(branch.isPrimary)
        : branch.is_primary !== undefined
        ? Boolean(branch.is_primary)
        : false,
  };
};

const normalizeRestaurant = (payload) => {
  if (!payload) return null;
  const branches = Array.isArray(payload.branches)
    ? payload.branches
        .map(normalizeBranch)
        .filter((branch) => branch && (branch.id || branch.name))
    : [];
  return {
    id: payload.id || payload.restaurant_id || payload.restaurantId || null,
    name:
      payload.name ||
      payload.legal_name ||
      payload.legalName ||
      payload.profile?.legal_name ||
      payload.profile?.legalName ||
    "Restaurant",
    branches,
  };
};

const expandMemberRecords = (records = []) => {
  const list = Array.isArray(records) ? records : [];
  return list.flatMap((account) => {
    const base = {
      name: account.displayName || account.fullName || account.email,
      email: account.email,
      phone: account.phone || "",
      status: account.isActive === false ? "suspended" : "active",
      requiresPasswordReset: Boolean(account.requiresPasswordReset),
    };
    const memberships = Array.isArray(account.memberships) && account.memberships.length
      ? account.memberships
      : [null];
    return memberships.map((membership, index) => ({
      id: membership?.id ? `${account.id}:${membership.id}` : `${account.id}:${index}`,
      accountId: account.id,
      role: membership?.role || "staff",
      branchId: membership?.branchId || null,
      status: membership?.isActive === false ? "suspended" : base.status,
      lastLogin: membership?.lastLogin || null,
      ...base,
    }));
  });
};

const AccountManagement = () => {
  const { restaurantProfile } = useAppContext();
  const ownerId = restaurantProfile?.id || null;
  const ownerEmail =
    restaurantProfile?.email ||
    restaurantProfile?.profile?.ownerEmail ||
    restaurantProfile?.profile?.contact_email ||
    "";
  const ownerFullName =
    restaurantProfile?.fullName ||
    restaurantProfile?.full_name ||
    `${restaurantProfile?.first_name || ""} ${
      restaurantProfile?.last_name || ""
    }`.trim() ||
    restaurantProfile?.profile?.manager_name ||
    "Primary Owner";
  const brandName =
    restaurantProfile?.profile?.legal_name ||
    restaurantProfile?.profile?.legalName ||
    restaurantProfile?.restaurant_name ||
    "Your Restaurant";

  const [restaurant, setRestaurant] = useState(null);
  const [branches, setBranches] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(Boolean(ownerId));
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);
  const [credentials, setCredentials] = useState({
    email: ownerEmail,
    password: "",
    confirmPassword: "",
  });
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "manager",
    branchId: "",
    manualPassword: "",
  });

  useEffect(() => {
    setCredentials((prev) => ({ ...prev, email: ownerEmail || "" }));
  }, [ownerEmail]);

  useEffect(() => {
    if (!ownerId) {
      setLoadingRestaurant(false);
      setRestaurant(null);
      return;
    }
    let cancelled = false;
    setLoadingRestaurant(true);
    setLoadError(null);
    restaurantManagerService
      .getByOwner(ownerId)
      .then((data) => {
        if (cancelled) return;
        const normalized = normalizeRestaurant(data);
        setRestaurant(normalized);
        setBranches(normalized?.branches || []);
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Unable to load restaurant data";
        setLoadError(message);
        setRestaurant(null);
        setBranches([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRestaurant(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  useEffect(() => {
    if (!showForm) return;
    const fallbackBranch =
      branches.find((branch) => branch.isPrimary)?.id ||
      branches[0]?.id ||
      "";
    setInviteForm((prev) => ({
      ...prev,
      branchId: fallbackBranch,
    }));
  }, [branches, showForm]);

  const branchLookup = useMemo(() => {
    const map = new Map();
    branches.forEach((branch) => {
      if (branch.id) {
        map.set(branch.id, branch);
      }
    });
    return map;
  }, [branches]);

  const resolvedMembers = useMemo(() => {
    return members.map((member) => {
      const branch = member.branchId ? branchLookup.get(member.branchId) : null;
      const branchName = branch?.name || member.branchLabel || "Unassigned";
      return {
        ...member,
        branchName,
      };
    });
  }, [members, branchLookup]);

  const branchOptions = useMemo(() => {
    return branches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));
  }, [branches]);

  const reloadMembers = useCallback(async () => {
    if (!restaurant?.id) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await restaurantManagerService.listMembers(restaurant.id);
      const records = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      setMembers(expandMemberRecords(records));
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to load staff accounts";
      setMembersError(message);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    reloadMembers();
  }, [reloadMembers]);

  const handleCredentialChange = (event) => {
    const { name, value } = event.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCredentialSubmit = (event) => {
    event.preventDefault();
    toast.success("Owner main credential update flow coming soon.");
    setCredentials((prev) => ({
      ...prev,
      password: "",
      confirmPassword: "",
    }));
  };

  const toggleInviteForm = () => {
    if (!restaurant?.id) {
      toast.error("Create a restaurant profile before inviting staff.");
      return;
    }
    if (!branches.length) {
      toast.error("Add at least one branch to assign staff.");
      return;
    }
    setInviteError(null);
    setInviteResult(null);
    setShowForm((prev) => !prev);
  };

  const handleInviteChange = (event) => {
    const { name, value } = event.target;
    setInviteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    if (!restaurant?.id) return;
    if (!inviteForm.branchId) {
      setInviteError("Please choose a branch for this account.");
      return;
    }
    if (inviteForm.manualPassword && inviteForm.manualPassword.trim().length < 8) {
      setInviteError("Manual password must be at least 8 characters long.");
      return;
    }
    const manualPasswordClean =
      inviteForm.manualPassword && inviteForm.manualPassword.trim().length >= 8
        ? inviteForm.manualPassword.trim()
        : null;
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      const payload = {
        branchId: inviteForm.branchId,
        role: inviteForm.role,
        loginEmail: inviteForm.email,
        displayName: inviteForm.fullName,
        phone: inviteForm.phone,
        temporaryPassword: manualPasswordClean || undefined,
      };
      const result = await restaurantManagerService.inviteMember(
        restaurant.id,
        payload
      );
      const temporaryPassword =
        result?.temporaryPassword ||
        result?.response?.temporaryPassword ||
        null;
      const revealedPassword = temporaryPassword || manualPasswordClean || null;
      await reloadMembers();
      setInviteResult({
        email: inviteForm.email,
        password: revealedPassword,
      });
      setInviteForm({
        fullName: "",
        email: "",
        phone: "",
        role: inviteForm.role,
        branchId: inviteForm.branchId,
        manualPassword: "",
      });
      setShowForm(false);
      toast.success("Staff invitation created");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to invite staff member";
      setInviteError(message);
      toast.error(message);
    } finally {
      setInviteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={containerClasses}>
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Account Management
            </h1>
            <p className="text-sm text-slate-600">
              Owner main controls every branch. Delegate branch-specific roles
              to owners, managers, and staff.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
              View Activity Log
            </button>
            <button
              onClick={toggleInviteForm}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
            >
              {showForm ? "Close" : "Add Staff Account"}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Owner Main Credentials
            </h2>
            <p className="text-sm text-slate-600">
              Only the owner main account can manage brand-level settings and
              branches.
            </p>
            <form className="space-y-4" onSubmit={handleCredentialSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={credentials.email}
                  onChange={handleCredentialChange}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New Password
                  </label>
                  <input
                    name="password"
                    type="password"
                    value={credentials.password}
                    onChange={handleCredentialChange}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Confirm Password
                  </label>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={credentials.confirmPassword}
                    onChange={handleCredentialChange}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
              </div>
              <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                Update Credentials
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Security Settings
            </h2>
            <div className="flex flex-col gap-4">
              <SecurityToggle
                title="Two-factor authentication"
                description="Request OTP codes when managers access from new devices."
                defaultChecked
              />
              <SecurityToggle
                title="Auto logout"
                description="Sign out inactive staff after 30 minutes."
                defaultChecked
              />
              <SecurityToggle
                title="Restrict IP ranges"
                description="Allow staff access only from whitelisted locations."
              />
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
                Owner Main
              </span>
              <StatusBadge status="active" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">{brandName}</p>
              <p className="text-sm text-slate-600">
                {ownerFullName} &middot; {ownerEmail || "Email pending"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Capabilities
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {ROLE_CAPABILITIES.owner_main.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
            <h3 className="text-base font-semibold text-slate-900">
              Branch Role Matrix
            </h3>
            {["owner", "manager", "staff"].map((role) => (
              <div
                key={role}
                className={`rounded-xl border px-4 py-3 ${ROLE_COLORS[role]}`}
              >
                <p className="text-sm font-semibold uppercase tracking-wide">
                  {ROLE_LABELS[role]}
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed">
                  {ROLE_CAPABILITIES[role].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-base">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Branch Staff
              </h2>
              <p className="text-sm text-slate-600">
                Owner, manager, and staff accounts must belong to a specific
                branch.
              </p>
            </div>
            <button
              onClick={toggleInviteForm}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              {showForm ? "Cancel" : "Invite Staff"}
            </button>
          </div>

          {inviteResult?.email && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">
                Temporary password for {inviteResult.email}
              </p>
              <p className="font-mono text-base">
                {inviteResult.password || "Generated password sent to email"}
              </p>
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleInviteSubmit}
              className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Full name
                  </label>
                  <input
                    name="fullName"
                    value={inviteForm.fullName}
                    onChange={handleInviteChange}
                    type="text"
                    placeholder="Tran Minh"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Login email
                  </label>
                  <input
                    required
                    name="email"
                    value={inviteForm.email}
                    onChange={handleInviteChange}
                    type="email"
                    placeholder="account@tastyqueen.vn"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </label>
                  <select
                    name="role"
                    value={inviteForm.role}
                    onChange={handleInviteChange}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="owner">Owner (branch)</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Branch scope
                  </label>
                  <select
                    required
                    name="branchId"
                    value={inviteForm.branchId}
                    onChange={handleInviteChange}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="">Select branch</option>
                    {branchOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Set password (optional)
                </label>
                <input
                  name="manualPassword"
                  value={inviteForm.manualPassword}
                  onChange={handleInviteChange}
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <p className="text-xs text-slate-500">
                  Minimum 8 characters. Leave empty to let the system generate a password.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone (optional)
                </label>
                <input
                  name="phone"
                  value={inviteForm.phone}
                  onChange={handleInviteChange}
                  type="text"
                  placeholder="+84 9xx xxx xxx"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <p className="text-xs text-slate-500">
                Enter a password to share manually, or leave blank to auto-generate one (displayed once).
              </p>
              {inviteError && (
                <p className="text-sm text-red-600">{inviteError}</p>
              )}
              <button
                disabled={inviteSubmitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {inviteSubmitting ? "Sending..." : "Send Invitation"}
              </button>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left uppercase text-xs font-medium tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {membersLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      Loading staff accounts...
                    </td>
                  </tr>
                ) : resolvedMembers.length ? (
                  resolvedMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {member.email} &middot; {member.phone || "No phone"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {member.branchName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {member.lastLogin ? formatDate(member.lastLogin) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={member.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      {membersError
                        ? `Unable to load staff accounts: ${membersError}`
                        : "No staff accounts yet. Invite your first manager."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {loadError && (
            <p className="text-sm text-red-600">
              Unable to load restaurant details: {loadError}
            </p>
          )}
          {membersError && !membersLoading && (
            <p className="text-sm text-red-600">
              Unable to load staff accounts: {membersError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const SecurityToggle = ({ title, description, defaultChecked = false }) => (
  <label className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
    <input
      type="checkbox"
      defaultChecked={defaultChecked}
      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
    />
    <span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </span>
  </label>
);

const RoleBadge = ({ role }) => {
  const label = ROLE_LABELS[role] || role;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${ROLE_COLORS[role] ||
        "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  if (!status) {
    return null;
  }
  const normalized = status.toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_STYLES[normalized] || "bg-slate-100 text-slate-600"
      }`}
    >
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default AccountManagement;
