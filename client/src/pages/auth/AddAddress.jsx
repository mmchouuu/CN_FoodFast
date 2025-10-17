import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

const LABEL_OPTIONS = [
  { id: "home", label: "Home" },
  { id: "company", label: "Office" },
  { id: "school", label: "School" },
  { id: "custom", label: "Other" },
];

const AddAddress = () => {
  const { addNewAddress, setSelectedAddressId } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const defaultEmail = location?.state?.email || "";

  const [label, setLabel] = useState(LABEL_OPTIONS[0].id);
  const [customLabel, setCustomLabel] = useState("");
  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("Ho Chi Minh City");
  const [instructions, setInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const onSubmit = (event) => {
    event.preventDefault();
    const computedLabel =
      label === "custom"
        ? customLabel.trim() || "Other"
        : LABEL_OPTIONS.find((item) => item.id === label)?.label || "Home";
    const id = `addr-${Date.now()}`;
    addNewAddress({
      id,
      label: computedLabel,
      recipient: "",
      phone: "",
      street,
      ward,
      district,
      city,
      instructions,
      isDefault,
    });
    if (isDefault) {
      setSelectedAddressId(id);
    }
    navigate("/auth/login", {
      replace: true,
      state: { email: defaultEmail },
    });
  };

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Add a delivery address
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Save a default address to check out faster next time.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {LABEL_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setLabel(option.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  label === option.id
                    ? "bg-orange-500 text-white"
                    : "bg-orange-50 text-gray-600 hover:bg-orange-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {label === "custom" ? (
            <input
              type="text"
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              placeholder="Custom label name"
              className="w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          ) : null}
          <label className="text-sm text-gray-600">
            Street / House number
            <input
              type="text"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-gray-600">
              Ward
              <input
                type="text"
                value={ward}
                onChange={(event) => setWard(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="text-sm text-gray-600">
              District
              <input
                type="text"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="text-sm text-gray-600">
              City
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          <label className="text-sm text-gray-600">
            Driver instructions (optional)
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-orange-100 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
            />
            Set as default address
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Save address & log in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          You can skip this step and{" "}
          <Link to="/auth/login" className="font-semibold text-orange-500">
            log in now
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default AddAddress;
