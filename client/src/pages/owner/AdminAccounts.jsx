import React, { useState } from "react";
import { useAppContext } from "../../context/AppContext";

const AdminAccount = () => {
  const { user } = useAppContext();

  const [adminData, setAdminData] = useState({
    firstName: user?.firstName || "Admin",
    lastName: user?.lastName || "Owner",
    email: user?.email || "admin@fastfood.com",
    phone: user?.phone || "+1-555-000-000",
    role: "Admin",
    status: "active",
    createdAt: user?.createdAt || new Date().toISOString(),
  });

  const handleChange = (field, value) => {
    setAdminData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Ở thực tế: gửi request update đến User Service
    console.log("Saved admin profile:", adminData);
    alert("Admin profile updated! (simulated)");
  };

  const handleResetPassword = () => {
    // Ở thực tế: call User Service reset password
    alert("Password reset link sent to email! (simulated)");
  };

  return (
    <div className="md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-[var(--color-primary)] rounded-xl">
      <h2 className="text-2xl font-bold mb-6 text-[var(--color-solid)]">Admin Profile</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-[var(--color-solidTwo)]/20 text-[var(--color-solidTwo)] font-bold text-2xl">
              {adminData.firstName?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="flex flex-col gap-1">
              <input
                className="text-lg font-semibold border-b focus:outline-none"
                value={adminData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                placeholder="First Name"
              />
              <input
                className="text-lg font-semibold border-b focus:outline-none"
                value={adminData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                placeholder="Last Name"
              />
              <span className="text-xs text-gray-500">Role: {adminData.role}</span>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <input
                className="w-full border-b focus:outline-none py-1"
                value={adminData.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Phone</label>
              <input
                className="w-full border-b focus:outline-none py-1"
                value={adminData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 text-gray-500 text-sm">
            Created: {new Date(adminData.createdAt).toLocaleDateString()}
          </div>

          <button
            onClick={handleSave}
            className="mt-4 px-6 py-2 bg-[var(--color-solidTwo)] text-white rounded-xl font-semibold hover:bg-[var(--color-solid)] transition"
          >
            Save Changes
          </button>
          <button
            onClick={handleResetPassword}
            className="mt-2 px-6 py-2 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition"
          >
            Reset Password
          </button>
        </div>

        {/* Status & Info Card */}
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-[var(--color-solid)]">Account Status</h3>
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                adminData.status === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {adminData.status.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            As an Admin, you can manage your profile and access all services in the system:
            User Service, Product Service, Order Service, Payment Service.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminAccount;






