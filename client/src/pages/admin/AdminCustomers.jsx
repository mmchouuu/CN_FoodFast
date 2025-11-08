import React, { useEffect, useMemo, useState } from "react";
import adminService from "../../services/admin";

const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await adminService.getCustomers();
        setCustomers(data || []);
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Unable to load customers.");
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      setFiltered(customers);
      return;
    }
    setFiltered(
      customers.filter((customer) => {
        const name = `${customer.first_name || ""} ${customer.last_name || ""}`.toLowerCase();
        return (
          name.includes(keyword) ||
          (customer.email || "").toLowerCase().includes(keyword) ||
          (customer.phone || "").toLowerCase().includes(keyword)
        );
      }),
    );
  }, [customers, search]);

  const activeCount = useMemo(
    () => customers.filter((customer) => customer.is_active).length,
    [customers],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customer Management</h1>
          <p className="text-sm text-neutral-600">
            Review and manage customer accounts across the platform.
          </p>
        </div>
        <div className="text-sm text-neutral-500">
          Active customers:{" "}
          <span className="font-semibold text-neutral-800">
            {activeCount}/{customers.length}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or phone"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-3 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>
        <Table loading={loading} customers={filtered} />
      </div>
    </div>
  );
};

const Table = ({ loading, customers }) => {
  if (loading) {
    return <p className="px-6 py-6 text-sm text-neutral-500">Loading customers...</p>;
  }

  if (!customers.length) {
    return <p className="px-6 py-6 text-sm text-neutral-500">No customers found.</p>;
  }

  return (
    <table className="min-w-full divide-y divide-neutral-200 text-sm">
      <thead className="bg-neutral-50 text-left uppercase text-xs font-semibold text-neutral-500 tracking-wide">
        <tr>
          <th className="px-6 py-3">Customer</th>
          <th className="px-6 py-3">Email</th>
          <th className="px-6 py-3">Phone</th>
          <th className="px-6 py-3">Status</th>
          <th className="px-6 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-200">
        {customers.map((customer) => (
          <tr key={customer.id} className="hover:bg-neutral-50/80">
            <td className="px-6 py-4">
              <p className="font-semibold text-neutral-800">
                {formatName(customer.first_name, customer.last_name)}
              </p>
              <p className="text-xs text-neutral-500">{customer.id}</p>
            </td>
            <td className="px-6 py-4 text-neutral-600">{customer.email || "—"}</td>
            <td className="px-6 py-4 text-neutral-600">{customer.phone || "—"}</td>
            <td className="px-6 py-4">
              <StatusBadge isActive={customer.is_active} isVerified={customer.is_verified} />
            </td>
            <td className="px-6 py-4 text-right">
              <div className="inline-flex items-center gap-3 text-xs font-semibold text-neutral-600">
                <button className="hover:text-neutral-900">View</button>
                <button className="hover:text-neutral-900">
                  {customer.is_active ? "Lock" : "Unlock"}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const formatName = (firstName, lastName) => {
  const full = `${firstName || ""} ${lastName || ""}`.trim();
  return full || "Unnamed customer";
};

const StatusBadge = ({ isActive, isVerified }) => {
  let label = "Inactive";
  let classes = "bg-rose-100 text-rose-700";

  if (isActive && isVerified) {
    label = "Active & Verified";
    classes = "bg-emerald-100 text-emerald-700";
  } else if (isActive) {
    label = "Active";
    classes = "bg-amber-100 text-amber-700";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
};

export default AdminCustomers;
