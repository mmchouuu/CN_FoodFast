import React, { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import CartTotal from "../components/CartTotal";

const initialState = {
  label: "Home",
  recipient: "",
  phone: "",
  street: "",
  ward: "",
  district: "",
  city: "",
  instructions: "",
  isDefault: false,
};

const AddressForm = () => {
  const { addNewAddress, setSelectedAddressId } = useAppContext();
  const [formState, setFormState] = useState(initialState);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formState.recipient || !formState.phone || !formState.street) {
      toast.error("Please fill in the required fields.");
      return;
    }
    try {
      const created = await addNewAddress(formState);
      if (created?.id) {
        setSelectedAddressId(created.id);
      }
      toast.success("New address added to your account.");
      navigate("/checkout");
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to save address.";
      toast.error(message);
    }
  };

  return (
    <div className="max-padd-container grid gap-10 py-24 lg:grid-cols-[1.3fr,1fr]">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl bg-white p-8 shadow-sm"
      >
        <header>
          <h1 className="text-3xl font-bold text-gray-900">
            Add delivery address
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            We use this information to deliver your orders accurately.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Address label
            <select
              name="label"
              value={formState.label}
              onChange={handleChange}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="Home">Home</option>
              <option value="Office">Office</option>
              <option value="Family">Family</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <input
              type="checkbox"
              name="isDefault"
              checked={formState.isDefault}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
            />
            Set as default address
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Recipient name*
            <input
              type="text"
              name="recipient"
              value={formState.recipient}
              onChange={handleChange}
              placeholder="Tran Minh Anh"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Phone number*
            <input
              type="tel"
              name="phone"
              value={formState.phone}
              onChange={handleChange}
              placeholder="+84 909 111 222"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Street and house number*
          <input
            type="text"
            name="street"
            value={formState.street}
            onChange={handleChange}
            placeholder="24 Nguyen Dinh Chieu"
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Ward
            <input
              type="text"
              name="ward"
              value={formState.ward}
              onChange={handleChange}
              placeholder="Ward 6"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            District
            <input
              type="text"
              name="district"
              value={formState.district}
              onChange={handleChange}
              placeholder="District 3"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            City
            <input
              type="text"
              name="city"
              value={formState.city}
              onChange={handleChange}
              placeholder="Ho Chi Minh City"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Delivery instructions
          <textarea
            name="instructions"
            value={formState.instructions}
            onChange={handleChange}
            rows={3}
            placeholder="Gate code, pet information, preferred drop-off point..."
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Save address
        </button>
      </form>

      <aside>
        <CartTotal />
      </aside>
    </div>
  );
};

export default AddressForm;
