// import React from 'react'

// const UserAccounts = () => {
//   return (
//     <div>UserAccounts</div>
//   )
// }

// export default UserAccounts

import React, { useMemo, useState } from "react";
import { useAppContext } from "../../context/AppContext";

const initialUsers = [
  {
    _id: "67b5b9e54ea97f71bbc196a0",
    userId: "68591d36daf423db94fa8f4f",
    firstName: "user",
    lastName: "one",
    email: "userone@gmail.com",
    street: "789 Elm Street",
    city: "Springfield",
    state: "California",
    zipcode: 90210,
    country: "US",
    phone: "+1-555-123-4567",
    role: "user",
    status: "active",
    createdAt: "2025-01-15T08:30:00Z",
  },
  {
    _id: "67b5b9e54ea97f71bbc196a1",
    userId: "68591d36daf423db94fa8f50",
    firstName: "Lan",
    lastName: "Tran",
    email: "lan.tran@gmail.com",
    street: "12 Nguyen Trai",
    city: "Hanoi",
    state: "Hanoi",
    zipcode: 100000,
    country: "VN",
    phone: "+84-912-345-678",
    role: "user",
    status: "active",
    createdAt: "2025-03-10T10:00:00Z",
  },
  {
    _id: "67b5b9e54ea97f71bbc196a2",
    userId: "68591d36daf423db94fa8f51",
    firstName: "Minh",
    lastName: "Nguyen",
    email: "minh.nguyen@example.com",
    street: "25 Le Loi",
    city: "Ho Chi Minh",
    state: "HCM",
    zipcode: 700000,
    country: "VN",
    phone: "+84-903-111-222",
    role: "user",
    status: "banned",
    createdAt: "2025-05-01T09:20:00Z",
  },
];

const UserAccounts = () => {
  const { currency } = useAppContext();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const matches = `${u.firstName} ${u.lastName} ${u.email} ${u.phone}`.toLowerCase();
        if (!matches.includes(q)) return false;
      }
      if (filterStatus !== "all") {
        return u.status === filterStatus;
      }
      return true;
    });
  }, [users, search, filterStatus]);

  const toggleStatus = (id) => {
    setUsers(prev => prev.map(u => u._id === id ? { ...u, status: u.status === "active" ? "banned" : "active" } : u));
    console.log("Toggled status for", id);
  };

  const removeUser = (id) => {
    setUsers(prev => prev.filter(u => u._id !== id));
    console.log("Deleted user", id);
  };

  return (
    <div className="md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">User Accounts</h2>
        <div className="flex gap-2 items-center">
          <input
            className="px-3 py-2 rounded-lg border w-64 text-sm"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="px-3 py-2 rounded-lg border text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[var(--color-solidOne)] text-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((u) => (
              <tr key={u._id} className="hover:bg-[var(--color-primary)]">
                <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[var(--color-solidTwo)]/20 text-[var(--color-solidTwo)] font-semibold">
                    {u.firstName?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--color-textColor)]">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-[var(--color-gray-50)]">Role: {u.role}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-textColor)]">
                  <div>{u.email}</div>
                  <div className="text-xs text-[var(--color-gray-50)]">{u.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-textColor)]">
                  {u.street}, {u.city}, {u.country}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-gray-50)]">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      u.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end gap-2">
                  <button
                    onClick={() => toggleStatus(u._id)}
                    className={`px-3 py-1 rounded-md text-sm border ${
                      u.status === "active"
                        ? "bg-[var(--color-solidTwo)] text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {u.status === "active" ? "Ban" : "Activate"}
                  </button>
                  <button
                    onClick={() => removeUser(u._id)}
                    className="px-3 py-1 rounded-md text-sm bg-[var(--color-solidOne)]/20 text-[var(--color-solidOne)] border border-[var(--color-solidOne)]"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserAccounts;
