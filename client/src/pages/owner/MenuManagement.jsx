import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { dishPlaceholderImage } from "../../utils/imageHelpers";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";
import ownerProductService from "../../services/ownerProducts";

const containerClasses = "bg-white shadow-sm rounded-2xl border border-slate-100 p-6 space-y-6";
const SYSTEM_TAX_RATE = 8;
const SAMPLE_RESTAURANT = {
  id: "sample-restaurant",
  name: "Tasty Queen Demo",
};

const SAMPLE_PRODUCTS = [
  {
    id: "sample-1",
    title: "Spicy Beef Pho",
    description: "Traditional pho with tender beef, chili oil, and fresh herbs.",
    category: "Noodles",
    type: "Main",
    base_price: 75000,
    images: [
      "https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=600&q=80",
    ],
    popular: true,
    is_active: true,
  },
  {
    id: "sample-2",
    title: "Grilled Pork Broken Rice",
    description: "Com suon with pickled veggies, fried egg, and scallion oil.",
    category: "Rice Dishes",
    type: "Combo",
    base_price: 68000,
    images: [
      "https://images.unsplash.com/photo-1589308078050-002c61c2d6b6?auto=format&fit=crop&w=600&q=80",
    ],
    popular: false,
    is_active: true,
  },
  {
    id: "sample-3",
    title: "Classic Milk Tea",
    description: "Assam black tea shaken with milk and golden boba pearls.",
    category: "Drinks",
    type: "Beverage",
    base_price: 42000,
    images: [
      "https://images.unsplash.com/photo-1527169402691-feff5539e52c?auto=format&fit=crop&w=600&q=80",
    ],
    popular: false,
    is_active: false,
  },
];

const SAMPLE_CATEGORIES = ["Noodles", "Rice Dishes", "Drinks"];

const isSampleId = (value) => typeof value === "string" && value.startsWith("sample-");
const isSampleRestaurant = (restaurant) => !restaurant || isSampleId(restaurant.id);
const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0 VND";
  return `${numeric.toLocaleString("vi-VN")} VND`;
};

const computePricing = (state) => {
  const base = Number(state.basePrice || 0);
  const taxRate = Number(state.taxRate || 0);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0;
  const safeRate = Number.isFinite(taxRate) ? taxRate : SYSTEM_TAX_RATE;
  const taxAmount = Number(((safeBase * safeRate) / 100).toFixed(2));
  const priceWithTax = Number((safeBase + taxAmount).toFixed(2));
  return {
    ...state,
    taxRate: safeRate,
    taxAmount,
    priceWithTax,
  };
};

const emptyFormState = computePricing({
  title: "",
  description: "",
  category: "",
  type: "",
  basePrice: "",
  imageMode: "url",
  imageUrl: "",
  imagePreview: "",
  popular: false,
  isHidden: true,
  taxRate: SYSTEM_TAX_RATE,
  branchInventory: {},
});

const buildFormFromProduct = (product) => {
  const firstImage =
    (Array.isArray(product?.images) && product.images.find((img) => !!img)) ||
    product?.imagePreview ||
    product?.image ||
    product?.imageUrl ||
    "";
  const mode =
    typeof firstImage === "string" && firstImage.startsWith("data:") ? "upload" : "url";

  return computePricing({
    title: product?.title || "",
    description: product?.description || "",
    category: product?.category || "",
    type: product?.type || "",
    basePrice:
      product?.base_price === 0 || product?.base_price
        ? String(Number(product.base_price))
        : "",
    imageMode: mode,
    imageUrl: mode === "url" ? firstImage : "",
    imagePreview: firstImage,
    popular: Boolean(product?.popular),
    isHidden: product?.is_active === false,
    taxRate: SYSTEM_TAX_RATE,
    branchInventory: {},
  });
};

const DishFormModal = ({
  open,
  mode,
  form,
  categoryOptions,
  branches = [],
  branchInventory = {},
  inventoryReadonly = false,
  onInventoryChange,
  onClose,
  onChange,
  onSubmit,
  saving,
}) => {
  if (!open) return null;

  const updateForm = (changes) => {
    onChange((previous) => computePricing({ ...previous, ...changes }));
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === form.imageMode) return;
    if (nextMode === "upload") {
      updateForm({
        imageMode: "upload",
        imageUrl: "",
      });
      return;
    }
    updateForm({
      imageMode: "url",
      imagePreview: form.imageUrl?.trim() || "",
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() || "";
      updateForm({
        imageMode: "upload",
        imagePreview: result,
        imageUrl: "",
      });
    };
    reader.onerror = () => toast.error("Unable to read image file.");
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (value) => {
    updateForm({
      imageMode: "url",
      imageUrl: value,
      imagePreview: value.trim(),
    });
  };

  const hasBranches = Array.isArray(branches) && branches.length > 0;
  const disableInventoryInputs = inventoryReadonly || saving;
  const changeBranchInventory = (branchId, field, value) => {
    if (typeof onInventoryChange === "function") {
      onInventoryChange(branchId, field, value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40">
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {mode === "edit" ? "Update Dish" : "Add New Dish"}
              </h2>
              <p className="text-sm text-slate-500">
                Fill in the product fields. Pricing with tax is calculated automatically.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              onClick={onClose}
              aria-label="Close"
            >
              X
            </button>
          </div>

          <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">Name*</span>
              <input
                type="text"
                required
                value={form.title}
                onChange={(event) => updateForm({ title: event.target.value })}
                placeholder="Dish name"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">Category</span>
              <select
                value={form.category}
                onChange={(event) => updateForm({ category: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">-- None --</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">
                Manage categories from the panel on the main screen.
              </span>
            </label>

            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">Description</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                placeholder="Short description"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">Type</span>
              <input
                type="text"
                value={form.type}
                onChange={(event) => updateForm({ type: event.target.value })}
                placeholder="Standard"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">Base price*</span>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={form.basePrice}
                onChange={(event) => updateForm({ basePrice: event.target.value })}
                placeholder="Base price"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="text-sm font-semibold text-slate-700">Tax summary</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-slate-500">Tax rate</span>
                  <div className="rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    {form.taxRate}% (system default)
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-slate-500">Tax amount</span>
                  <div className="rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-emerald-600 shadow-sm">
                    {formatCurrency(form.taxAmount)}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-slate-500">Price with tax</span>
                  <div className="rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
                    {formatCurrency(form.priceWithTax)}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.imageMode === "url"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => handleModeChange("url")}
                >
                  Use image URL
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.imageMode === "upload"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => handleModeChange("upload")}
                >
                  Upload image
                </button>
              </div>

              {form.imageMode === "url" ? (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-slate-700">Image URL</span>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(event) => handleUrlChange(event.target.value)}
                    placeholder="https://cdn.example.com/dish.jpg"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-slate-700">Choose image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-50"
                  />
                </label>
              )}

              {form.imagePreview ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="mb-2 block text-xs font-semibold uppercase text-slate-500">
                    Preview
                  </span>
                  <img
                    src={form.imagePreview || dishPlaceholderImage}
                    alt="Dish preview"
                    className="h-36 w-full rounded-lg object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = dishPlaceholderImage;
                    }}
                  />
                </div>
              ) : null}
            </div>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={!form.isHidden}
                onChange={(event) => updateForm({ isHidden: !event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">
                Publish immediately (unchecked keeps the dish hidden).
              </span>
            </label>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.popular}
                onChange={(event) => updateForm({ popular: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Mark as featured dish</span>
            </label>

            <div className="md:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Initial inventory by branch</h3>
                <p className="text-xs text-slate-500">
                  Optional: set starting quantities. You can always update inventory later from the
                  product list.
                </p>
              </div>
              {inventoryReadonly ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                  Inventory editing is disabled in demo mode.
                </div>
              ) : hasBranches ? (
                <div className="space-y-3">
                  {branches.map((branch) => {
                    const values = branchInventory?.[branch.id] || { quantity: "", reserved_qty: "" };
                    return (
                      <div
                        key={branch.id}
                        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{branch.name}</p>
                          {branch.street || branch.city ? (
                            <p className="text-xs text-slate-500">
                              {[branch.street, branch.city].filter(Boolean).join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="grid w-full max-w-md grid-cols-2 gap-3">
                          <label className="flex flex-col text-xs font-semibold uppercase text-slate-500">
                            Quantity
                            <input
                              type="number"
                              min="0"
                              value={values.quantity ?? ""}
                              onChange={(event) =>
                                changeBranchInventory(branch.id, "quantity", event.target.value)
                              }
                              disabled={disableInventoryInputs}
                              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                              placeholder="0"
                            />
                          </label>
                          <label className="flex flex-col text-xs font-semibold uppercase text-slate-500">
                            Reserved
                            <input
                              type="number"
                              min="0"
                              value={values.reserved_qty ?? ""}
                              onChange={(event) =>
                                changeBranchInventory(branch.id, "reserved_qty", event.target.value)
                              }
                              disabled={disableInventoryInputs}
                              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                              placeholder="0"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                  No branches available yet. Add a branch first to prefill inventory.
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-end gap-3 md:col-span-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : mode === "edit" ? "Update Dish" : "Create Dish"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const InventoryModal = ({
  open,
  productTitle,
  branches,
  draft,
  onChange,
  onSubmit,
  onClose,
  loading,
  saving,
  readonly,
}) => {
  if (!open) return null;

  const disabled = loading || saving || readonly;
  const hasBranches = Array.isArray(branches) && branches.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40">
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Inventory by Branch</h2>
            <p className="text-sm text-slate-500">
              {readonly
                ? "Inventory management is not available in demo mode."
                : `Update stock levels for “${productTitle || "Dish"}”.`}
            </p>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading inventory…</div>
          ) : hasBranches ? (
            <div className="space-y-4">
              {branches.map((branch) => {
                const values = draft?.[branch.id] || { quantity: "", reserved_qty: "" };
                return (
                  <div
                    key={branch.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{branch.name}</p>
                      {branch.street || branch.city ? (
                        <p className="text-xs text-slate-500">
                          {[branch.street, branch.city].filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={values.quantity ?? ""}
                          onChange={(event) =>
                            onChange(branch.id, "quantity", event.target.value)
                          }
                          disabled={disabled}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          Reserved
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={values.reserved_qty ?? ""}
                          onChange={(event) =>
                            onChange(branch.id, "reserved_qty", event.target.value)
                          }
                          disabled={disabled}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : readonly ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Inventory editing is disabled in demo mode.
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              No restaurant branches found. Add a branch first to manage inventory.
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSubmit}
              disabled={disabled || saving}
            >
              {saving ? "Saving..." : "Save inventory"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MenuManagement = () => {
  const { restaurantProfile, refreshCatalog } = useAppContext();
  const ownerRestaurantId = restaurantProfile?.id || null;

  const [restaurant, setRestaurant] = useState(() => SAMPLE_RESTAURANT);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState(() => [...SAMPLE_PRODUCTS]);
  const [error, setError] = useState("");
  const [usingSampleData, setUsingSampleData] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [showCategories, setShowCategories] = useState(true);
  const [customCategories, setCustomCategories] = useState(() => [...SAMPLE_CATEGORIES]);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [formState, setFormState] = useState(() => emptyFormState);
  const [activeProductId, setActiveProductId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [branches, setBranches] = useState([]);
  const [branchInventoryCache, setBranchInventoryCache] = useState({});
  const [inventoryModal, setInventoryModal] = useState({
    open: false,
    productId: null,
    productTitle: '',
    readonly: false,
  });
  const [inventoryDraft, setInventoryDraft] = useState({});
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySaving, setInventorySaving] = useState(false);
  const [visibilityOverrides, setVisibilityOverrides] = useState(() => ({}));

  const loadProducts = useCallback(
    async (restaurantId) => {
      if (!restaurantId || isSampleId(restaurantId)) {
        setUsingSampleData(true);
        setCustomCategories([...SAMPLE_CATEGORIES]);
        setProducts([...SAMPLE_PRODUCTS]);
        setVisibilityOverrides(() => ({}));
        setBranchInventoryCache({});
        return;
      }

      try {
        const list = await ownerProductService.listByRestaurant(restaurantId);
        if (Array.isArray(list) && list.length) {
          setUsingSampleData(false);
          setCustomCategories((previous) =>
            previous.filter((name) => !SAMPLE_CATEGORIES.includes(name))
          );
          setProducts(list);
          setVisibilityOverrides(() => ({}));
          setBranchInventoryCache({});
        } else {
          setUsingSampleData(true);
          setCustomCategories([...SAMPLE_CATEGORIES]);
          setProducts([...SAMPLE_PRODUCTS]);
          setVisibilityOverrides(() => ({}));
          setBranchInventoryCache({});
        }
      } catch (requestError) {
        const message =
          requestError?.response?.data?.error ||
          requestError?.message ||
          "Unable to load dishes.";
        toast.error(message);
        setUsingSampleData(true);
        setCustomCategories([...SAMPLE_CATEGORIES]);
        setProducts([...SAMPLE_PRODUCTS]);
        setVisibilityOverrides(() => ({}));
        setBranchInventoryCache({});
      }
    },
    []
  );

  const loadBranches = useCallback(
    async (restaurantId) => {
      if (!restaurantId || isSampleId(restaurantId)) {
        setBranches([]);
        return [];
      }
      try {
        const list = await restaurantManagerService.listBranches(restaurantId);
        const mapped = Array.isArray(list) ? list : [];
        setBranches(mapped);
        return mapped;
      } catch (requestError) {
        const message =
          requestError?.response?.data?.error ||
          requestError?.message ||
          "Unable to load restaurant branches.";
        toast.error(message);
        setBranches([]);
        return [];
      }
    },
    [],
  );

  const loadData = useCallback(async () => {
    if (!ownerRestaurantId) {
      setLoading(false);
      setError("");
      setRestaurant(SAMPLE_RESTAURANT);
      setUsingSampleData(true);
      setProducts([...SAMPLE_PRODUCTS]);
      setVisibilityOverrides(() => ({}));
      setBranches([]);
      setBranchInventoryCache({});
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await restaurantManagerService.getByOwner(ownerRestaurantId);
      if (!data || data.pending_profile) {
        setRestaurant(SAMPLE_RESTAURANT);
        setUsingSampleData(true);
        setProducts([...SAMPLE_PRODUCTS]);
        setVisibilityOverrides(() => ({}));
        setBranches([]);
        setBranchInventoryCache({});
        return;
      }
      setRestaurant(data);
      await loadBranches(data.id);
      await loadProducts(data.id);
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to load data.";
      toast.error(message);
      setRestaurant(SAMPLE_RESTAURANT);
      setUsingSampleData(true);
      setProducts([...SAMPLE_PRODUCTS]);
      setVisibilityOverrides(() => ({}));
      setBranches([]);
      setBranchInventoryCache({});
    } finally {
      setLoading(false);
    }
  }, [ownerRestaurantId, loadProducts, loadBranches]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const derivedCategories = useMemo(() => {
    const collected = products
      .map((product) => product.category)
      .filter((value) => typeof value === "string" && value.trim().length);
    return Array.from(new Set(collected)).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const categories = useMemo(() => {
    const combined = new Set([...derivedCategories, ...customCategories]);
    return Array.from(combined).sort((a, b) => a.localeCompare(b));
  }, [derivedCategories, customCategories]);

  const filteredProducts = useMemo(() => {
    const min = Number(priceRange.min);
    const max = Number(priceRange.max);
    return products.filter((product) => {
      const title = product.title?.toLowerCase() || "";
      const category = product.category?.toLowerCase() || "";
      const matchesSearch =
        !searchTerm ||
        title.includes(searchTerm.toLowerCase()) ||
        category.includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" ||
        !selectedCategory ||
        product.category === selectedCategory;

      const base = Number(product.base_price || 0);
      const matchesMin = !Number.isFinite(min) || min <= 0 || base >= min;
      const matchesMax = !Number.isFinite(max) || max <= 0 || base <= max;

      return matchesSearch && matchesCategory && matchesMin && matchesMax;
    });
  }, [products, searchTerm, selectedCategory, priceRange]);

  const openCreateModal = () => {
    setModalMode("create");
    setActiveProductId(null);
    setFormState(() => ({
      ...emptyFormState,
      branchInventory: buildInventoryDraftForProduct(branches, []),
    }));
    setModalOpen(true);
  };

  const openEditModal = async (product) => {
    if (!product) return;
    setModalMode("edit");
    setActiveProductId(product.id);

    const sampleMode =
      usingSampleData || isSampleRestaurant(restaurant) || isSampleId(product.id);

    if (sampleMode || !restaurant?.id) {
      setFormState(() => ({
        ...buildFormFromProduct(product),
        branchInventory: buildInventoryDraftForProduct(branches, []),
      }));
      setModalOpen(true);
      return;
    }

    let currentBranches = branches;
    if (!currentBranches.length) {
      currentBranches = await loadBranches(restaurant.id);
    }
    if (!currentBranches.length) {
      currentBranches = branches;
    }

    let inventoryRecords = branchInventoryCache[product.id];
    if (!inventoryRecords) {
      try {
        const fetched = await ownerProductService.fetchInventory(restaurant.id, product.id);
        inventoryRecords = Array.isArray(fetched) ? fetched : [];
        setBranchInventoryCache((previous) => ({ ...previous, [product.id]: inventoryRecords }));
      } catch (requestError) {
        const message =
          requestError?.response?.data?.error ||
          requestError?.message ||
          "Unable to load product inventory.";
        toast.error(message);
        inventoryRecords = [];
      }
    }

    setFormState(() => ({
      ...buildFormFromProduct(product),
      branchInventory: buildInventoryDraftForProduct(currentBranches, inventoryRecords),
    }));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setFormState(() => ({
      ...emptyFormState,
      branchInventory: buildInventoryDraftForProduct(branches, []),
    }));
    setActiveProductId(null);
  };

  const handleFormBranchInventoryChange = (branchId, field, value) => {
    setFormState((previous) => ({
      ...previous,
      branchInventory: {
        ...(previous.branchInventory || {}),
        [branchId]: {
          ...(previous.branchInventory?.[branchId] || {}),
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = formState.title.trim();
    if (!trimmedTitle) {
      toast.error("Dish name is required.");
      return;
    }

    const priceValue = Number(formState.basePrice);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast.error("Base price is not valid.");
      return;
    }

    let images = [];
    if (formState.imageMode === "upload" && formState.imagePreview) {
      images = [formState.imagePreview];
    } else if (formState.imageMode === "url" && formState.imageUrl.trim()) {
      images = [formState.imageUrl.trim()];
    }

    const restaurantId = restaurant?.id;

    const payload = {
      restaurant_id: restaurantId,
      title: trimmedTitle,
      description: formState.description.trim() || null,
      category: formState.category.trim() || null,
      type: formState.type.trim() || null,
      base_price: priceValue,
      images,
      popular: Boolean(formState.popular),
      is_active: !formState.isHidden,
    };

    const sampleMode = usingSampleData || isSampleRestaurant(restaurant);

    if (!sampleMode && !restaurantId) {
      toast.error("Restaurant information is missing.");
      return;
    }

    if (!sampleMode && formState.branchInventory) {
      const branchInventories = [];
      for (const [branchId, values] of Object.entries(formState.branchInventory)) {
        if (!branchId) continue;
        const branchExists = branches.some((branch) => branch.id === branchId);
        if (!branchExists) continue;

        const quantityValue = values?.quantity ?? "";
        const reservedValue = values?.reserved_qty ?? "";

        const quantity =
          quantityValue === "" || quantityValue === null ? null : Number(quantityValue);
        if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
          toast.error("Inventory quantity must be a non-negative number.");
          return;
        }

        const reserved =
          reservedValue === "" || reservedValue === null ? null : Number(reservedValue);
        if (reserved !== null && (!Number.isFinite(reserved) || reserved < 0)) {
          toast.error("Reserved quantity must be a non-negative number.");
          return;
        }

        const entry = { branch_id: branchId };
        if (quantity !== null) entry.quantity = quantity;
        if (reserved !== null) entry.reserved_qty = reserved;

        if (Object.keys(entry).length > 1) {
          branchInventories.push(entry);
        }
      }

      if (branchInventories.length) {
        payload.branch_inventories = branchInventories;
      }
    }

    let shouldCloseModal = false;
    let shouldRefresh = false;

    setSaving(true);
    try {
      if (modalMode === "edit" && activeProductId) {
        if (sampleMode || isSampleId(activeProductId)) {
          setProducts((previous) =>
            previous.map((product) =>
              product.id === activeProductId
                ? {
                    ...product,
                    ...payload,
                    base_price: priceValue,
                    images,
                    tax_amount: formState.taxAmount,
                    price_with_tax: formState.priceWithTax,
                  }
                : product
            )
          );
          setVisibilityOverrides((previous) => {
            const next = { ...previous };
            delete next[activeProductId];
            return next;
          });
          toast.success("Dish updated.");
          shouldCloseModal = true;
        } else {
          const updated = await ownerProductService.update(restaurantId, activeProductId, payload);
          setProducts((previous) =>
            previous.map((product) =>
              product.id === activeProductId ? { ...product, ...updated } : product
            )
          );
          toast.success("Dish updated.");
          shouldRefresh = true;
          shouldCloseModal = true;
        }
      } else {
        if (sampleMode) {
          const newId = `sample-${Date.now()}`;
          const newProduct = {
            id: newId,
            ...payload,
            base_price: priceValue,
            images,
            tax_amount: formState.taxAmount,
            price_with_tax: formState.priceWithTax,
          };
          setProducts((previous) => [...previous, newProduct]);
          toast.success("Dish created.");
          shouldCloseModal = true;
        } else {
          const created = await ownerProductService.create(restaurantId, payload);
          setProducts((previous) => [...previous, created]);
          setVisibilityOverrides((previous) => ({
            ...previous,
            [created.id]: formState.isHidden,
          }));
          toast.success("Dish created.");
          shouldRefresh = true;
          shouldCloseModal = true;
        }
      }

      if (shouldRefresh) {
        await refreshCatalog();
      }
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to save dish.";
      toast.error(message);
    } finally {
      setSaving(false);
    }

    if (shouldCloseModal) {
      closeModal();
    }
  };

  const handleDelete = async (product) => {
    const confirmed = window.confirm(`Delete dish "${product.title}"?`);
    if (!confirmed) return;

    const sampleMode =
      usingSampleData || isSampleRestaurant(restaurant) || isSampleId(product.id);

    if (sampleMode) {
      setProducts((previous) => previous.filter((item) => item.id !== product.id));
      setBranchInventoryCache((previous) => {
        const next = { ...previous };
        delete next[product.id];
        return next;
      });
      setVisibilityOverrides((previous) => {
        const next = { ...previous };
        delete next[product.id];
        return next;
      });
      toast.success("Dish removed.");
      return;
    }

    try {
      if (!restaurant?.id) {
        toast.error("Restaurant information is missing.");
        return;
      }
      await ownerProductService.remove(restaurant.id, product.id);
      setProducts((previous) => previous.filter((item) => item.id !== product.id));
      toast.success("Dish removed.");
      await refreshCatalog();
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to delete dish.";
      toast.error(message);
    }
  };

  function buildInventoryDraftForProduct(branchList, records) {
    const byBranch = (Array.isArray(records) ? records : []).reduce((acc, item) => {
      if (item?.branch_id) {
        acc[item.branch_id] = item;
      }
      return acc;
    }, {});
    return (branchList || []).reduce((acc, branch) => {
      const record = byBranch[branch.id] || {};
      const quantity =
        typeof record.quantity === "number" && Number.isFinite(record.quantity)
          ? String(record.quantity)
          : "";
      const reserved =
        typeof record.reserved_qty === "number" && Number.isFinite(record.reserved_qty)
          ? String(record.reserved_qty)
          : "";
      acc[branch.id] = {
        quantity,
        reserved_qty: reserved,
      };
      return acc;
    }, {});
  }

  const openInventoryManager = async (product) => {
    if (!product) return;
    const readonly =
      usingSampleData || isSampleRestaurant(restaurant) || isSampleId(product.id);
    setInventoryModal({
      open: true,
      productId: product.id,
      productTitle: product.title || "Dish",
      readonly,
    });
    if (readonly || !restaurant?.id) {
      setInventoryDraft({});
      return;
    }

    setInventoryLoading(true);
    try {
      let currentBranches = branches;
      if (!currentBranches.length) {
        currentBranches = await loadBranches(restaurant.id);
      }
      if (!currentBranches.length) {
        currentBranches = branches;
      }
      let cached = branchInventoryCache[product.id];
      if (!cached) {
        const fetched = await ownerProductService.fetchInventory(restaurant.id, product.id);
        cached = Array.isArray(fetched) ? fetched : [];
        setBranchInventoryCache((previous) => ({ ...previous, [product.id]: cached }));
      }
      setInventoryDraft(buildInventoryDraftForProduct(currentBranches, cached));
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to load product inventory.";
      toast.error(message);
      setInventoryDraft(buildInventoryDraftForProduct(branches, []));
    } finally {
      setInventoryLoading(false);
    }
  };

  const closeInventoryManager = () => {
    setInventoryModal({
      open: false,
      productId: null,
      productTitle: '',
      readonly: false,
    });
    setInventoryDraft({});
    setInventoryLoading(false);
    setInventorySaving(false);
  };

  const handleInventoryDraftChange = (branchId, field, value) => {
    setInventoryDraft((previous) => ({
      ...previous,
      [branchId]: {
        ...(previous?.[branchId] || {}),
        [field]: value,
      },
    }));
  };

  const handleInventorySubmit = async () => {
    if (!inventoryModal.productId || !restaurant?.id) {
      closeInventoryManager();
      return;
    }

    if (inventoryModal.readonly) {
      closeInventoryManager();
      return;
    }

    const entries = Object.entries(inventoryDraft || {});
    const updates = [];
    for (const [branchId, values] of entries) {
      if (!branchId) continue;
      const quantityValue = values?.quantity ?? "";
      const reservedValue = values?.reserved_qty ?? "";

      const quantity =
        quantityValue === "" || quantityValue === null ? null : Number(quantityValue);
      if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
        toast.error("Inventory quantity must be a non-negative number.");
        return;
      }

      const reserved =
        reservedValue === "" || reservedValue === null ? null : Number(reservedValue);
      if (reserved !== null && (!Number.isFinite(reserved) || reserved < 0)) {
        toast.error("Reserved quantity must be a non-negative number.");
        return;
      }

      const payload = {};
      if (quantity !== null) payload.quantity = quantity;
      if (reserved !== null) payload.reserved_qty = reserved;

      if (Object.keys(payload).length) {
        updates.push({ branchId, payload });
      }
    }

    if (!updates.length) {
      toast.success("Nothing to update.");
      closeInventoryManager();
      return;
    }

    setInventorySaving(true);
    try {
      await Promise.all(
        updates.map(({ branchId, payload }) =>
          ownerProductService.updateInventory(
            restaurant.id,
            branchId,
            inventoryModal.productId,
            payload,
          ),
        ),
      );
      const refreshed = await ownerProductService.fetchInventory(
        restaurant.id,
        inventoryModal.productId,
      );
      const inventoryRecords = Array.isArray(refreshed) ? refreshed : [];
      setBranchInventoryCache((previous) => ({
        ...previous,
        [inventoryModal.productId]: inventoryRecords,
      }));

      const totalQuantity = inventoryRecords.reduce(
        (acc, item) => acc + Number(item.quantity || 0),
        0,
      );
      const totalReserved = inventoryRecords.reduce(
        (acc, item) => acc + Number(item.reserved_qty || 0),
        0,
      );

      setProducts((previous) =>
        previous.map((product) =>
          product.id === inventoryModal.productId
            ? {
                ...product,
                inventory_summary: {
                  ...(product.inventory_summary || {}),
                  quantity: totalQuantity,
                  reserved_qty: totalReserved,
                },
              }
            : product,
        ),
      );

      toast.success("Inventory updated successfully.");
      closeInventoryManager();
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to update inventory.";
      toast.error(message);
    } finally {
      setInventorySaving(false);
    }
  };

  const handleVisibilityToggle = (productId) => {
    const target = products.find((item) => item.id === productId);
    if (!target) return;

    // ✅ FIX: cần ngoặc khi kết hợp ?? với ||
    const currentHidden =
      (visibilityOverrides[productId] ??
        (target.is_active === false || target.status === "hidden"));

    const nextHidden = !currentHidden;

    if (usingSampleData || isSampleRestaurant(restaurant) || isSampleId(productId)) {
      setProducts((previous) =>
        previous.map((product) =>
          product.id === productId ? { ...product, is_active: !nextHidden } : product
        )
      );
      return;
    }

    setVisibilityOverrides((previous) => ({
      ...previous,
      [productId]: nextHidden,
    }));
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error("Category name cannot be empty.");
      return;
    }
    setCustomCategories((previous) => {
      if (previous.includes(trimmed) || derivedCategories.includes(trimmed)) {
        toast("Category already exists.");
        return previous;
      }
      toast.success("Category added (frontend only).");
      return [...previous, trimmed];
    });
    setNewCategoryName("");
  };

  if (loading) {
    return (
      <div className={containerClasses}>
        <p className="text-sm text-slate-500">Loading dishes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClasses}>
        <p className="text-sm text-rose-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className={containerClasses}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dish Management</h1>
            <p className="text-sm text-slate-600">
              Manage menu items, categories, pricing, and inventory for today.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              type="button"
              onClick={() => toast("Bulk import will be added later.")}
            >
              Bulk Import
            </button>
            <button
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              type="button"
              onClick={openCreateModal}
            >
              Add Dish
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
              Categories
            </h2>
            <button
              type="button"
              className="text-xs font-semibold uppercase text-emerald-600 hover:text-emerald-700"
              onClick={() => setShowCategories((previous) => !previous)}
            >
              {showCategories ? "Hide list" : "Show list"}
            </button>
          </div>
          {showCategories ? (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap gap-2">
                {categories.length ? (
                  categories.map((category) => {
                    const count =
                      products.filter((product) => product.category === category).length;
                    return (
                      <span
                        key={category}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-sm text-slate-700 shadow-sm"
                      >
                        {category}
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
                          {count}
                        </span>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm text-slate-500">No categories yet.</span>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="New category name"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                  onClick={handleAddCategory}
                >
                  Add category
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-500">Search</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name or category"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-500">Category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="text-xs uppercase text-slate-500">Price from</span>
              <input
                type="number"
                min="0"
                value={priceRange.min}
                onChange={(event) =>
                  setPriceRange((previous) => ({ ...previous, min: event.target.value }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase text-slate-500">To</span>
              <input
                type="number"
                min="0"
                value={priceRange.max}
                onChange={(event) =>
                  setPriceRange((previous) => ({ ...previous, max: event.target.value }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      <section className={containerClasses}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-auto">
            <thead>
              <tr className="bg-slate-50 text-sm uppercase text-slate-500">
                <th className="px-4 py-3 text-left font-semibold">Image</th>
                <th className="px-4 py-3 text-left font-semibold">Dish</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-left font-semibold">Base price</th>
                <th className="px-4 py-3 text-left font-semibold">Price with tax</th>
                <th className="px-4 py-3 text-left font-semibold">Inventory</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length ? (
                filteredProducts.map((product) => {
                  const primaryImage =
                    (Array.isArray(product?.images) &&
                      product.images.find((img) => typeof img === "string" && img)) ||
                    product?.imagePreview ||
                    product?.image ||
                    product?.imageUrl ||
                    "";
                  const displayImage = primaryImage || dishPlaceholderImage;
                  const inventorySummary = product.inventory_summary || {};
                  const totalQuantity = Number(inventorySummary.quantity || 0);
                  const totalReserved = Number(inventorySummary.reserved_qty || 0);
                  const manageDisabled =
                    usingSampleData || isSampleRestaurant(restaurant) || isSampleId(product.id);

                  const hidden =
                    visibilityOverrides[product.id] ??
                    (product.is_active === false || product.status === "hidden");
                  const statusLabel = hidden ? "Hidden" : "Visible";
                  const statusStyles = hidden
                    ? "bg-slate-200 text-slate-600"
                    : "bg-emerald-100 text-emerald-700";

                  const taxAmount = Number(
                    ((Number(product.base_price || 0) * SYSTEM_TAX_RATE) / 100).toFixed(2)
                  );
                  const priceWithTax = Number(
                    (Number(product.base_price || 0) + taxAmount).toFixed(2)
                  );

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          <img
                            src={displayImage}
                            alt={product.title}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = dishPlaceholderImage;
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{product.title}</span>
                          {product.description ? (
                            <span className="text-xs text-slate-500 line-clamp-2">
                              {product.description}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {product.category || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        {formatCurrency(product.base_price)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700">
                        {formatCurrency(priceWithTax)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2 text-sm">
                          <span className="font-semibold text-slate-800">
                            {totalQuantity.toLocaleString("vi-VN")} in stock
                          </span>
                          <span className="text-xs text-slate-500">
                            Reserved: {totalReserved.toLocaleString("vi-VN")}
                          </span>
                          <button
                            type="button"
                            className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => openInventoryManager(product)}
                            disabled={manageDisabled}
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                          <button
                            className="text-emerald-600 hover:text-emerald-700"
                            type="button"
                            onClick={() => openEditModal(product)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-amber-600 hover:text-amber-700"
                            type="button"
                            onClick={() => handleVisibilityToggle(product.id)}
                          >
                            {hidden ? "Show" : "Hide"}
                          </button>
                          <button
                            className="text-rose-500 hover:text-rose-600"
                            type="button"
                            onClick={() => handleDelete(product)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    No dishes match the current filters. Add a new dish to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DishFormModal
        open={modalOpen}
        mode={modalMode}
        form={formState}
        categoryOptions={categories}
        branches={branches}
        branchInventory={formState.branchInventory || {}}
        inventoryReadonly={usingSampleData || isSampleRestaurant(restaurant)}
        onInventoryChange={handleFormBranchInventoryChange}
        onClose={closeModal}
        onChange={setFormState}
        onSubmit={handleSubmit}
        saving={saving}
      />
      <InventoryModal
        open={inventoryModal.open}
        productTitle={inventoryModal.productTitle}
        branches={branches}
        draft={inventoryDraft}
        onChange={handleInventoryDraftChange}
        onSubmit={handleInventorySubmit}
        onClose={closeInventoryManager}
        loading={inventoryLoading}
        saving={inventorySaving}
        readonly={inventoryModal.readonly}
      />
    </div>
  );
};

export default MenuManagement;
