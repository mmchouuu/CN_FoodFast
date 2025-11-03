import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { dishPlaceholderImage } from "../../utils/imageHelpers";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";
import ownerProductService from "../../services/ownerProducts";

const containerClasses =
  "bg-white shadow-sm rounded-2xl border border-slate-100 p-6 space-y-6";
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

const createOptionChoice = () => ({
  id: `choice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  label: "",
  priceDelta: "",
});

const createOptionGroup = () => ({
  id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  required: false,
  allowMultiple: false,
  choices: [createOptionChoice()],
});

const toFiniteNumber = (value, fallback) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeOptionGroupsForState = (groups = []) => {
  const source = Array.isArray(groups) ? groups : [];
  return source
    .map((group, groupIndex) => {
      if (!group) return null;
      const name = (group.name || group.label || "").trim();
      if (!name) return null;

      const displayOrder = toFiniteNumber(
        group.display_order ?? group.displayOrder ?? group.order ?? group.position,
        groupIndex,
      );

      const selectionTypeRaw = (group.selectionType || group.selection_type || group.type || "")
        .toString()
        .toLowerCase();

      let allowMultiple = group.allowMultiple;
      if (allowMultiple === undefined) {
        if (selectionTypeRaw === "single") {
          allowMultiple = false;
        } else if (selectionTypeRaw === "multiple") {
          allowMultiple = true;
        }
      }

      const maxSelectRaw =
        group.maxSelect ??
        group.max_select ??
        group.group_max_select ??
        group.maxChoices ??
        null;
      if (allowMultiple === undefined) {
        if (maxSelectRaw === 1) {
          allowMultiple = false;
        } else if (maxSelectRaw !== null && maxSelectRaw !== undefined) {
          allowMultiple = toFiniteNumber(maxSelectRaw, 2) !== 1;
        }
      }
      if (allowMultiple === undefined) {
        allowMultiple = true;
      }

      const minSelectRaw =
        group.minSelect ??
        group.min_select ??
        group.group_min_select ??
        group.minChoices ??
        null;

      const requiredRaw =
        group.required ??
        group.is_required ??
        group.isRequired ??
        group.group_is_required ??
        null;

      const minSelect =
        minSelectRaw === null || minSelectRaw === undefined
          ? allowMultiple
            ? 0
            : 1
          : toFiniteNumber(minSelectRaw, allowMultiple ? 0 : 1);
      const maxSelect =
        maxSelectRaw === null || maxSelectRaw === undefined
          ? allowMultiple
            ? null
            : 1
          : toFiniteNumber(maxSelectRaw, allowMultiple ? null : 1);
      const required =
        requiredRaw === null || requiredRaw === undefined
          ? minSelect > 0
          : Boolean(requiredRaw);

      const rawChoices =
        (Array.isArray(group.choices) && group.choices.length && group.choices) ||
        (Array.isArray(group.items) && group.items.length && group.items) ||
        (Array.isArray(group.values) && group.values.length && group.values) ||
        [];

      const decoratedChoices = rawChoices
        .map((choice, choiceIndex) => ({
          value: choice,
          index: choiceIndex,
          order: toFiniteNumber(
            choice?.display_order ??
              choice?.displayOrder ??
              choice?.order ??
              choice?.position,
            choiceIndex,
          ),
        }))
        .sort((a, b) => a.order - b.order);

      const choices = decoratedChoices
        .map(({ value: choice, order, index: choiceIndex }) => {
          if (!choice) return null;
          const label = (choice.label || choice.name || choice.value || choice.title || "").trim();
          if (!label) return null;
          const choiceId =
            choice.id ||
            choice.item_id ||
            choice.value_id ||
            choice.option_id ||
            `choice-${groupIndex}-${choiceIndex}`;
          const priceRaw =
            choice.priceDelta ??
            choice.price_delta ??
            choice.price ??
            choice.extra_price ??
            choice.priceModifier ??
            choice.delta ??
            0;
          const numericDelta = toFiniteNumber(priceRaw, 0) ?? 0;
          return {
            id: choiceId,
            label,
            description: choice.description || "",
            priceDelta: numericDelta,
            displayOrder: order,
          };
        })
        .filter(Boolean);

      const id =
        group.id ||
        group.group_id ||
        group.option_group_id ||
        `group-${groupIndex}`;

      return {
        id,
        name,
        description: group.description || group.summary || "",
        allowMultiple: Boolean(allowMultiple),
        required,
        minSelect,
        maxSelect,
        displayOrder,
        choices,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        toFiniteNumber(a.displayOrder, 32767) - toFiniteNumber(b.displayOrder, 32767),
    );
};

const deriveOptionGroupsFromProduct = (product) => {
  if (!product) return [];
  if (Array.isArray(product.optionGroups) && product.optionGroups.length) {
    return normalizeOptionGroupsForState(product.optionGroups);
  }
  if (Array.isArray(product.options) && product.options.length) {
    return normalizeOptionGroupsForState(product.options);
  }
  if (Array.isArray(product.option_groups) && product.option_groups.length) {
    return normalizeOptionGroupsForState(product.option_groups);
  }
  return [];
};

const buildFormOptionGroupsFromProduct = (product) =>
  deriveOptionGroupsFromProduct(product).map((group, groupIndex) => ({
    id: group.id || createOptionGroup().id,
    name: group.name || "",
    required: Boolean(group.required),
    allowMultiple: Boolean(group.allowMultiple),
    displayOrder:
      group.displayOrder === null || group.displayOrder === undefined
        ? groupIndex
        : group.displayOrder,
    choices:
      Array.isArray(group.choices) && group.choices.length
        ? group.choices.map((choice, choiceIndex) => ({
            id: choice.id || createOptionChoice().id,
            label: choice.label || "",
            priceDelta:
              choice.priceDelta === 0 || choice.priceDelta
                ? String(choice.priceDelta)
                : "",
            displayOrder:
              choice.displayOrder === null || choice.displayOrder === undefined
                ? choiceIndex
                : choice.displayOrder,
          }))
        : [
            {
              ...createOptionChoice(),
              displayOrder: 0,
            },
          ],
  }));

const formatPriceDeltaLabel = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "Included";
  }
  const absolute = Math.abs(numeric);
  const formatted = formatCurrency(absolute);
  return numeric > 0 ? `+ ${formatted}` : `- ${formatted}`;
};

const normalizeBranchId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      value.id ||
      value.branchId ||
      value.branch_id ||
      value.branch?.id ||
      null
    );
  }
  return null;
};

const deriveAssignedBranchIds = (branchList = [], assignmentList = [], fallbackToAll = false) => {
  const availableIds = branchList
    .map((branch) => normalizeBranchId(branch))
    .filter((id, index, self) => id && self.indexOf(id) === index);

  const assignedIds = (assignmentList || [])
    .map((assignment) => normalizeBranchId(assignment))
    .filter((id, index, self) => id && self.indexOf(id) === index && availableIds.includes(id));

  if (assignedIds.length) {
    return assignedIds;
  }

  return fallbackToAll ? availableIds : [];
};

const buildInventorySummary = (items = []) => {
  const summary = {
    quantity: 0,
    reserved_qty: 0,
    byBranch: {},
  };
  if (!Array.isArray(items)) {
    return summary;
  }
  items.forEach((item) => {
    if (!item) return;
    const branchId = normalizeBranchId(item);
    if (!branchId) return;
    const rawQuantity =
      item.quantity ??
      item?.inventory?.quantity ??
      0;
    const rawReserved =
      item.reserved_qty ??
      item?.inventory?.reserved_qty ??
      0;
    const quantity = Number.isFinite(Number(rawQuantity)) ? Number(rawQuantity) : 0;
    const reserved = Number.isFinite(Number(rawReserved)) ? Number(rawReserved) : 0;
    summary.quantity += quantity;
    summary.reserved_qty += reserved;
    summary.byBranch[branchId] = {
      quantity,
      reserved_qty: reserved,
    };
  });
  return summary;
};

const decorateProductsWithInventory = (items = []) =>
  (Array.isArray(items) ? items : []).map((product) => {
    const assignments = Array.isArray(product?.branch_assignments)
      ? product.branch_assignments
      : [];
    return {
      ...product,
      inventory_summary: buildInventorySummary(assignments),
    };
  });

const decorateProductWithInventory = (product = {}) =>
  decorateProductsWithInventory([product])[0] || {
    ...product,
    inventory_summary: buildInventorySummary(
      Array.isArray(product?.branch_assignments) ? product.branch_assignments : [],
    ),
  };

const normalizeCategoryAssignments = (assignments = []) =>
  (Array.isArray(assignments) ? assignments : [])
    .map((assignment) => {
      if (!assignment) return null;
      const branchId = normalizeBranchId(assignment);
      if (!branchId) return null;
      return {
        branch_id: branchId,
        is_visible: assignment.is_visible !== false,
        is_active: assignment.is_active !== false,
        display_order:
          assignment.display_order ?? assignment.displayOrder ?? null,
      };
    })
    .filter(Boolean);

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
  assignedBranches: [],
  optionGroups: [],
});

/** Chu?n ho� form t? product (s?a t? buildFormFromDish ? buildFormFromProduct) */
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
    assignedBranches: Array.isArray(product?.assignedBranches)
      ? product.assignedBranches
      : Array.isArray(product?.branch_assignments)
        ? product.branch_assignments
          .map((assignment) => normalizeBranchId(assignment))
          .filter(Boolean)
        : [],
    optionGroups: buildFormOptionGroupsFromProduct(product),
  });
};

/** Modal t?o/s?a m�n an � d� lo?i b? form l?ng nhau, d?ng b? field */
const DishFormModal = ({
  open,
  mode,
  form,
  categoryOptions = [],
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
    if (!changes || typeof onChange !== "function") return;
    const next = computePricing({ ...form, ...changes });
    onChange(next);
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === form.imageMode) return;
    if (nextMode === "upload") {
      updateForm({ imageMode: "upload", imageUrl: "" });
      return;
    }
    updateForm({ imageMode: "url", imagePreview: form.imageUrl?.trim() || "" });
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
      updateForm({ imageMode: "upload", imagePreview: result, imageUrl: "" });
    };
    reader.onerror = () => toast.error("Unable to read image file.");
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (value) => {
    updateForm({ imageMode: "url", imageUrl: value, imagePreview: value.trim() });
  };

  const hasBranches = Array.isArray(branches) && branches.length > 0;
  const disableInventoryInputs = inventoryReadonly || saving;
  const optionGroups = Array.isArray(form.optionGroups) ? form.optionGroups : [];

  const applyOptionGroups = (nextGroups) => {
    updateForm({ optionGroups: nextGroups });
  };

  const addOptionGroup = () => {
    applyOptionGroups([...optionGroups, createOptionGroup()]);
  };

  const updateOptionGroupField = (groupId, patch) => {
    applyOptionGroups(
      optionGroups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    );
  };

  const removeOptionGroup = (groupId) => {
    applyOptionGroups(optionGroups.filter((group) => group.id !== groupId));
  };

  const addOptionChoice = (groupId) => {
    applyOptionGroups(
      optionGroups.map((group) =>
        group.id === groupId
          ? { ...group, choices: [...(group.choices || []), createOptionChoice()] }
          : group,
      ),
    );
  };

  const updateOptionChoice = (groupId, choiceId, patch) => {
    applyOptionGroups(
      optionGroups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          choices: (group.choices || []).map((choice) =>
            choice.id === choiceId ? { ...choice, ...patch } : choice,
          ),
        };
      }),
    );
  };

  const removeOptionChoice = (groupId, choiceId) => {
    applyOptionGroups(
      optionGroups.map((group) => {
        if (group.id !== groupId) return group;
        const currentChoices = group.choices || [];
        if (currentChoices.length <= 1) return group;
        return {
          ...group,
          choices: currentChoices.filter((choice) => choice.id !== choiceId),
        };
      }),
    );
  };

  const availableBranches = Array.isArray(branches) ? branches : [];
  const assignedBranches = Array.isArray(form.assignedBranches)
    ? form.assignedBranches.filter(Boolean)
    : [];
  const assignedSet = new Set(assignedBranches);
  const allBranchesSelected =
    availableBranches.length > 0 && assignedSet.size === availableBranches.length;

  const ensureInventorySnapshot = (ids = []) => {
    const current = form.branchInventory || {};
    let next = { ...current };
    let mutated = false;
    ids.forEach((branchId) => {
      if (!next[branchId]) {
        next = { ...next, [branchId]: { quantity: "", reserved_qty: "" } };
        mutated = true;
      }
    });
    return mutated ? next : current;
  };

  const toggleBranchAssignment = (rawBranchId) => {
    const branchId = normalizeBranchId(rawBranchId);
    if (!branchId) return;
    const currentlySelected = assignedSet.has(branchId);
    if (currentlySelected) {
      const nextAssigned = assignedBranches.filter((id) => id !== branchId);
      updateForm({ assignedBranches: nextAssigned });
      return;
    }
    const nextInventory = ensureInventorySnapshot([branchId]);
    const nextAssigned = [...assignedBranches, branchId];
    updateForm({ assignedBranches: nextAssigned, branchInventory: nextInventory });
  };

  const selectAllBranches = () => {
    if (!availableBranches.length) return;
    const ids = availableBranches
      .map((branch) => normalizeBranchId(branch))
      .filter(Boolean);
    const nextInventory = ensureInventorySnapshot(ids);
    updateForm({ assignedBranches: ids, branchInventory: nextInventory });
  };

  const clearBranchSelection = () => {
    updateForm({ assignedBranches: [] });
  };

  const changeBranchInventory = (branchId, field, value) => {
    const normalisedId = normalizeBranchId(branchId);
    if (!normalisedId || !assignedSet.has(normalisedId)) {
      return;
    }
    if (typeof onInventoryChange === "function") {
      onInventoryChange(normalisedId, field, value);
    }
  };

  const selectedInventoryBranches = availableBranches.filter((branch) =>
    assignedSet.has(normalizeBranchId(branch)),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[calc(100vh-3rem)] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {mode === "edit" ? "Edit Dish" : "Add New Dish"}
            </h2>
            <p className="text-sm text-slate-500">
              Provide the primary details for this menu item.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close modal"
          >
            X
          </button>
        </div>

        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">Name*</span>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  placeholder="Dish name"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => updateForm({ category: e.target.value })}
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
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder="Short description"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">Type</span>
                <input
                  type="text"
                  value={form.type}
                  onChange={(e) => updateForm({ type: e.target.value })}
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
                  onChange={(e) => updateForm({ basePrice: e.target.value })}
                  placeholder="68000"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <p className="text-sm font-semibold text-slate-700">Tax summary</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase text-slate-500">Tax rate</span>
                    <div className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                      {form.taxRate}% (system default)
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase text-slate-500">Tax amount</span>
                    <div className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-600 shadow-sm">
                      {formatCurrency(form.taxAmount)}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase text-slate-500">Price with tax</span>
                    <div className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
                      {formatCurrency(form.priceWithTax)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${form.imageMode === "url"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    onClick={() => handleModeChange("url")}
                  >
                    Use image URL
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${form.imageMode === "upload"
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
                      onChange={(e) => handleUrlChange(e.target.value)}
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

              <div className="md:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Branch availability</h3>
                    <p className="text-xs text-slate-500">
                      Choose which branches can sell this dish. Deselect a branch to hide the item
                      there.
                    </p>
                  </div>
                  {hasBranches ? (
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllBranches}
                        disabled={!availableBranches.length || allBranchesSelected}
                        className="rounded-lg border border-emerald-300 px-3 py-1 font-semibold text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={clearBranchSelection}
                        disabled={!assignedSet.size}
                        className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>

                {hasBranches ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {availableBranches.map((branch) => {
                        const branchId = normalizeBranchId(branch);
                        if (!branchId) return null;
                        const selected = assignedSet.has(branchId);
                        return (
                          <button
                            type="button"
                            key={branchId}
                            onClick={() => toggleBranchAssignment(branchId)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${selected
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/50"
                              }`}
                          >
                            {branch.name || "Unnamed branch"}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {assignedSet.size
                        ? `${assignedSet.size} ${assignedSet.size === 1 ? "branch" : "branches"} selected.`
                        : "No branches selected. This dish will remain hidden until at least one branch is chosen."}
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                    No branches available yet. Add a restaurant branch to make this dish visible in-store.
                  </div>
                )}
              </div>

              <div className="md:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Options & modifiers</h3>
                    <p className="text-xs text-slate-500">
                      Build sizes, toppings, and extras. Stored locally until backend support is ready.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addOptionGroup}
                    className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                  >
                    + Add option group
                  </button>
                </div>

                {optionGroups.length ? (
                  <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                    {optionGroups.map((group, index) => (
                      <div
                        key={group.id}
                        className="space-y-3 rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <label className="flex flex-1 flex-col gap-1">
                            <span className="text-xs font-semibold uppercase text-slate-500">
                              Group {index + 1} name
                            </span>
                            <input
                              type="text"
                              value={group.name}
                              onChange={(event) =>
                                updateOptionGroupField(group.id, { name: event.target.value })
                              }
                              placeholder="Size, Toppings, ..."
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeOptionGroup(group.id)}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                          >
                            Remove group
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={group.required}
                              onChange={(event) =>
                                updateOptionGroupField(group.id, { required: event.target.checked })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                            />
                            Required
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={group.allowMultiple}
                              onChange={(event) =>
                                updateOptionGroupField(group.id, {
                                  allowMultiple: event.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                            />
                            Allow multiple selections
                          </label>
                        </div>

                        <div className="space-y-2">
                          {(group.choices || []).map((choice) => (
                            <div
                              key={choice.id}
                              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"
                            >
                              <label className="flex flex-1 flex-col text-xs font-semibold uppercase text-slate-500">
                                Option label
                                <input
                                  type="text"
                                  value={choice.label}
                                  onChange={(event) =>
                                    updateOptionChoice(group.id, choice.id, {
                                      label: event.target.value,
                                    })
                                  }
                                  placeholder="Large, Extra cheese"
                                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                />
                              </label>
                              <label className="flex w-full max-w-[140px] flex-col text-xs font-semibold uppercase text-slate-500">
                                Price delta
                                <div className="relative mt-1">
                                  <input
                                    type="number"
                                    step="500"
                                    value={choice.priceDelta}
                                    onChange={(event) =>
                                      updateOptionChoice(group.id, choice.id, {
                                        priceDelta: event.target.value,
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none"
                                  />
                                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-semibold uppercase text-slate-400">
                                    VND
                                  </span>
                                </div>
                              </label>
                              <button
                                type="button"
                                onClick={() => removeOptionChoice(group.id, choice.id)}
                                className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                                disabled={(group.choices || []).length <= 1}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => addOptionChoice(group.id)}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          + Add choice
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500">
                    No options yet. Click "Add option group" to start defining modifiers.
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={!form.isHidden}
                  onChange={(e) => updateForm({ isHidden: !e.target.checked })}
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
                  onChange={(e) => updateForm({ popular: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Mark as featured dish</span>
              </label>

              <div className="md:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Initial inventory by branch</h3>
                  <p className="text-xs text-slate-500">
                    Optional: set starting quantities. You can always update inventory later from the product list.
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
                                onChange={(e) =>
                                  changeBranchInventory(branch.id, "quantity", e.target.value)
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
                                onChange={(e) =>
                                  changeBranchInventory(branch.id, "reserved_qty", e.target.value)
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
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : mode === "edit" ? "Update Dish" : "Create Dish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ComboModal = ({
  open,
  form,
  products = [],
  onClose,
  onChange,
  onToggleProduct,
  onSubmit,
}) => {
  if (!open) return null;

  const selectedProducts = new Set(form.productIds || []);
  const toggleProduct = (productId) => {
    if (typeof onToggleProduct === "function") {
      onToggleProduct(productId);
    }
  };

  const updateField = (field, value) => {
    if (typeof onChange === "function") {
      onChange({ [field]: value });
    }
  };

  const [selectedCategory, setSelectedCategory] = useState("");

  const categoryList = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  );


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[calc(100vh-4rem)]">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create combo</h2>
            <p className="text-sm text-slate-500">
              Combine existing dishes into a curated offer. This is a front-end preview only.
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

        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">Combo name*</span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Family Feast"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">Combo price*</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  placeholder="120000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-12 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase text-slate-400">
                  VND
                </span>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Select dishes
                  </span>
                  {categoryList.length > 0 && (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">All categories</option>
                      {categoryList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {selectedProducts.size} selected
                </span>
              </div>

              <span className="text-xs text-slate-500">
                {selectedProducts.size} selected
              </span>
            </div>
            <div className="mt-3 grid max-h-72 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {products.length ? (
                products
                  .filter((p) => !selectedCategory || p.category === selectedCategory)
                  .map((product) => {

                    const checked = selectedProducts.has(product.id);
                    const preview =
                      (Array.isArray(product.images) && product.images[0]) || dishPlaceholderImage;
                    return (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left shadow-sm transition ${checked
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50"
                          }`}
                      >
                        <img
                          src={preview}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = dishPlaceholderImage;
                          }}
                        />
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-semibold text-slate-800">
                            {product.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            {product.category || "Uncategorised"}
                          </span>
                          <span className="text-xs font-semibold text-emerald-600">
                            {product.base_price
                              ? `${Number(product.base_price).toLocaleString("vi-VN")} VND`
                              : "—"}
                          </span>
                        </div>

                        <div
                          className={`h-4 w-4 rounded-full border ${checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                            }`}
                        />
                      </button>
                    );
                  })
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  Add dishes first to build combos.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p>
              Combos are stored in-memory. Hook up the backend endpoint later to persist them and
              make them available to customers.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Save combo
            </button>
          </div>
        </form>
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
                : `Update stock levels for ${productTitle || "Dish"}.`}
            </p>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading inventory</div>
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
                          onChange={(e) => onChange(branch.id, "quantity", e.target.value)}
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
                          onChange={(e) => onChange(branch.id, "reserved_qty", e.target.value)}
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
  const [products, setProducts] = useState(() => decorateProductsWithInventory(SAMPLE_PRODUCTS));
  const [expandedOptionRows, setExpandedOptionRows] = useState([]);
  const [error, setError] = useState("");
  const [usingSampleData, setUsingSampleData] = useState(true);
  const [ownerRestaurants, setOwnerRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [productsLoading, setProductsLoading] = useState(false);
  const [apiCategories, setApiCategories] = useState(() =>
  SAMPLE_CATEGORIES.map((name) => ({
    id: `sample-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    branchAssignments: [],
  })),
);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [showCategories, setShowCategories] = useState(true);
  const [customCategories, setCustomCategories] = useState(() => [...SAMPLE_CATEGORIES]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryBranchIds, setNewCategoryBranchIds] = useState([]);

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
    productTitle: "",
    readonly: false,
  });
  const [inventoryDraft, setInventoryDraft] = useState({});
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySaving, setInventorySaving] = useState(false);
  const [visibilityOverrides, setVisibilityOverrides] = useState(() => ({}));
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [comboForm, setComboForm] = useState({ name: "", price: "", productIds: [] });
  const [localCombos, setLocalCombos] = useState([]);

  const loadProducts = useCallback(async (restaurantId, query = {}) => {
    if (!restaurantId || isSampleId(restaurantId)) {
      setUsingSampleData(true);
      setApiCategories(
        SAMPLE_CATEGORIES.map((name) => ({
          id: `sample-${name.toLowerCase().replace(/\s+/g, "-")}`,
          name,
          branchAssignments: [],
        })),
      );
      setCustomCategories([...SAMPLE_CATEGORIES]);
      setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
      setVisibilityOverrides(() => ({}));
      setBranchInventoryCache({});
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);
    try {
      const [categoriesResponse, list] = await Promise.all([
        ownerProductService.listCategories(restaurantId),
        ownerProductService.listByRestaurant(restaurantId, query),
      ]);
      const normalizedCategoriesRaw = Array.isArray(categoriesResponse)
        ? categoriesResponse
            .map((category) => {
              if (typeof category === "string") {
                return { id: null, name: category.trim() };
              }
              if (category && typeof category === "object") {
                const name = (category.name || category.label || "").trim();
                if (!name) return null;
                const branchAssignments = normalizeCategoryAssignments(
                  category.branch_assignments || category.branchAssignments || []
                );
                return {
                  id: category.id || category.category_id || null,
                  name,
                  description: category.description || null,
                  productCount: Number(category.productCount ?? category.product_count ?? 0),
                  branchAssignments,
                };
              }
              return null;
            })
            .filter((item) => item && item.name)
        : [];
      const normalizedCategories = [];
      const seenCategoryNames = new Set();
      normalizedCategoriesRaw.forEach((item) => {
        const key = item.name.toLowerCase();
        if (seenCategoryNames.has(key)) return;
        seenCategoryNames.add(key);
        normalizedCategories.push(item);
      });

      setUsingSampleData(false);
      setApiCategories(normalizedCategories);
      setCustomCategories([]);
      const normalizedProducts = decorateProductsWithInventory(Array.isArray(list) ? list : []);
      setProducts(normalizedProducts);
      setVisibilityOverrides(() => ({}));
      setBranchInventoryCache({});
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to load dishes.";
      toast.error(message);
      setUsingSampleData(true);
      setApiCategories(
        SAMPLE_CATEGORIES.map((name) => ({
          id: `sample-${name.toLowerCase().replace(/\s+/g, "-")}`,
          name,
          branchAssignments: [],
        })),
      );
      setCustomCategories([...SAMPLE_CATEGORIES]);
      setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
      setVisibilityOverrides(() => ({}));
      setBranchInventoryCache({});
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async (restaurantId) => {
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
  }, []);

  const loadOwnerRestaurants = useCallback(async () => {
    if (!ownerRestaurantId) {
      setOwnerRestaurants([]);
      return [];
    }
    try {
      const response = await restaurantManagerService.listByOwner(ownerRestaurantId);
      const items = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
        ? response
        : [];
      setOwnerRestaurants(items);
      return items;
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to load restaurants.";
      toast.error(message);
      setOwnerRestaurants([]);
      return [];
    }
  }, [ownerRestaurantId]);

  const loadRestaurantDetail = useCallback(
    async (restaurantId, options = {}) => {
      const { branchId, silent } = options;
      if (!restaurantId) {
        setRestaurant(SAMPLE_RESTAURANT);
        setUsingSampleData(true);
        setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
        setVisibilityOverrides(() => ({}));
        setBranchInventoryCache({});
        setBranches([]);
        setSelectedRestaurantId(SAMPLE_RESTAURANT.id);
        setSelectedBranchId("all");
        return false;
      }

      try {
        const data = await restaurantManagerService.getRestaurant(restaurantId);
        if (!data || data.pending_profile) {
          setRestaurant(SAMPLE_RESTAURANT);
          setUsingSampleData(true);
          setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
          setVisibilityOverrides(() => ({}));
          setBranchInventoryCache({});
          setBranches([]);
          setSelectedRestaurantId(SAMPLE_RESTAURANT.id);
          setSelectedBranchId("all");
          return false;
        }

        setRestaurant(data);
        setSelectedRestaurantId(restaurantId);
        const branchList = Array.isArray(data?.branches) ? data.branches : [];
        setBranches(branchList);
        const resolvedBranch =
          branchId && branchList.some((branch) => branch.id === branchId) ? branchId : "all";
        setSelectedBranchId(resolvedBranch);
        await loadProducts(
          restaurantId,
          resolvedBranch !== "all" ? { branchId: resolvedBranch } : {},
        );
        setError("");
        return true;
      } catch (requestError) {
        if (!silent) {
          const message =
            requestError?.response?.data?.error ||
            requestError?.message ||
            "Unable to load restaurant.";
          toast.error(message);
          setError(message);
        }
        setRestaurant(SAMPLE_RESTAURANT);
        setUsingSampleData(true);
        setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
        setVisibilityOverrides(() => ({}));
        setBranchInventoryCache({});
        setBranches([]);
        setSelectedRestaurantId(SAMPLE_RESTAURANT.id);
        setSelectedBranchId("all");
        return false;
      }
    },
    [loadProducts],
  );

  const handleRestaurantSelect = useCallback(
    async (nextRestaurantId) => {
      const effectiveId =
        nextRestaurantId && nextRestaurantId !== SAMPLE_RESTAURANT.id ? nextRestaurantId : null;
      setSelectedRestaurantId(nextRestaurantId || SAMPLE_RESTAURANT.id);
      setSelectedBranchId("all");
      await loadRestaurantDetail(effectiveId, { branchId: "all" });
    },
    [loadRestaurantDetail],
  );

  const handleBranchFilterChange = useCallback(
    async (nextBranchId) => {
      const resolved = nextBranchId || "all";
      setSelectedBranchId(resolved);
      if (!restaurant?.id || usingSampleData) {
        return;
      }
      await loadProducts(
        restaurant.id,
        resolved !== "all" ? { branchId: resolved } : {},
      );
    },
    [restaurant, usingSampleData, loadProducts],
  );

  const loadData = useCallback(async () => {
    if (!ownerRestaurantId) {
      setLoading(false);
      setError("");
      setRestaurant(SAMPLE_RESTAURANT);
      setUsingSampleData(true);
      setApiCategories(
        SAMPLE_CATEGORIES.map((name) => ({
          id: `sample-${name.toLowerCase().replace(/\s+/g, "-")}`,
          name,
          branchAssignments: [],
        })),
      );
      setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
      setVisibilityOverrides(() => ({}));
      setBranches([]);
      setBranchInventoryCache({});
      setOwnerRestaurants([]);
      setSelectedRestaurantId(SAMPLE_RESTAURANT.id);
      setSelectedBranchId("all");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const list = await loadOwnerRestaurants();
      if (!list.length) {
        setRestaurant(SAMPLE_RESTAURANT);
        setUsingSampleData(true);
        setApiCategories(
          SAMPLE_CATEGORIES.map((name) => ({
            id: `sample-${name.toLowerCase().replace(/\s+/g, "-")}`,
            name,
            branchAssignments: [],
          })),
        );
        setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
        setVisibilityOverrides(() => ({}));
        setBranches([]);
        setBranchInventoryCache({});
        setSelectedRestaurantId(SAMPLE_RESTAURANT.id);
        setSelectedBranchId("all");
        return;
      }

      const preferred =
        selectedRestaurantId && list.some((item) => item.id === selectedRestaurantId)
          ? selectedRestaurantId
          : list[0]?.id;
      await loadRestaurantDetail(preferred, { silent: true });
      setError("");
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to load data.";
      toast.error(message);
      setError(message);
      setRestaurant(SAMPLE_RESTAURANT);
      setUsingSampleData(true);
      setApiCategories(
        SAMPLE_CATEGORIES.map((name) => ({
          id: `sample-${name.toLowerCase().replace(/\s+/g, "-")}`,
          name,
          branchAssignments: [],
        })),
      );
      setProducts(decorateProductsWithInventory(SAMPLE_PRODUCTS));
      setVisibilityOverrides(() => ({}));
      setBranches([]);
      setBranchInventoryCache({});
      setOwnerRestaurants([]);
      setSelectedRestaurantId(SAMPLE_RESTAURANT.id);
      setSelectedBranchId("all");
    } finally {
      setLoading(false);
    }
  }, [ownerRestaurantId, loadOwnerRestaurants, loadRestaurantDetail, selectedRestaurantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (usingSampleData) {
      setNewCategoryBranchIds([]);
      return;
    }
    if (!Array.isArray(branches) || !branches.length) {
      setNewCategoryBranchIds([]);
      return;
    }
    setNewCategoryBranchIds((previous) => {
      const validPrevious = Array.isArray(previous)
        ? previous.filter((id) => branches.some((branch) => branch.id === id))
        : [];
      if (validPrevious.length) {
        return validPrevious;
      }
      if (
        selectedBranchId !== "all" &&
        branches.some((branch) => branch.id === selectedBranchId)
      ) {
        return [selectedBranchId];
      }
      return [];
    });
  }, [branches, selectedBranchId, usingSampleData]);

  useEffect(() => {
    setExpandedOptionRows((previous) =>
      (Array.isArray(previous) ? previous : []).filter((id) =>
        products.some((product) => product.id === id),
      ),
    );
  }, [products]);

  const derivedCategories = useMemo(() => {
    const collected = products
      .map((product) => product.category)
      .filter((value) => typeof value === "string" && value.trim().length);
    return Array.from(new Set(collected)).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const categoryNames = useMemo(() => {
    const map = new Map();
    const pushName = (name) => {
      if (!name || typeof name !== "string") return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (map.has(key)) return;
      map.set(key, trimmed);
    };
    apiCategories.forEach((item) => pushName(item?.name));
    derivedCategories.forEach(pushName);
    customCategories.forEach(pushName);
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [apiCategories, derivedCategories, customCategories]);

  useEffect(() => {
    if (
      selectedCategory &&
      selectedCategory !== "all" &&
      !categoryNames.includes(selectedCategory)
    ) {
      setSelectedCategory("all");
    }
  }, [categoryNames, selectedCategory]);

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

  /** Hoisted function declaration � OK d�ng tru?c khi d?nh nghia */
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
      acc[branch.id] = { quantity, reserved_qty: reserved };
      return acc;
    }, {});
  }

  const openCreateModal = () => {
    setModalMode("create");
    setActiveProductId(null);
    setFormState(() => ({
      ...emptyFormState,
      branchInventory: buildInventoryDraftForProduct(branches, []),
    }));
    setModalOpen(true);
  };

  const openComboModal = () => {
    setComboForm({ name: "", price: "", productIds: [] });
    setComboModalOpen(true);
  };

  const closeComboModal = () => {
    setComboModalOpen(false);
  };

  const toggleComboProduct = (productId) => {
    setComboForm((previous) => {
      const hasProduct = previous.productIds.includes(productId);
      return {
        ...previous,
        productIds: hasProduct
          ? previous.productIds.filter((id) => id !== productId)
          : [...previous.productIds, productId],
      };
    });
  };

  const handleComboSubmit = async (event) => {
    event.preventDefault();
    const name = comboForm.name.trim();
    const priceValue = Number(comboForm.price);

    if (!name) {
      toast.error("Combo name is required.");
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast.error("Combo price must be a non-negative number.");
      return;
    }

    if (!comboForm.productIds.length) {
      toast.error("Please pick at least one product for this combo.");
      return;
    }

    const summary = {
      id: `combo-${Date.now()}`,
      name,
      price: priceValue,
      productIds: [...comboForm.productIds],
    };

    const sampleMode = usingSampleData || !restaurant?.id || isSampleRestaurant(restaurant);
    if (sampleMode) {
      setLocalCombos((previous) => [...previous, summary]);
      toast.success("Combo captured in demo mode.");
      setComboModalOpen(false);
      setComboForm({ name: "", price: "", productIds: [] });
      return;
    }

    try {
      await ownerProductService.createCombo(restaurant.id, {
        name,
        basePrice: priceValue,
        isActive: true,
        groups: [
          {
            name: "Included dishes",
            minSelect: comboForm.productIds.length,
            maxSelect: comboForm.productIds.length,
            required: true,
            items: comboForm.productIds.map((productId) => ({
              itemType: "product",
              productId,
              extraPrice: 0,
            })),
          },
        ],
      });
      toast.success("Combo created.");
      setComboModalOpen(false);
      setComboForm({ name: "", price: "", productIds: [] });
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Unable to create combo.";
      toast.error(message);
    }
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
      restaurantId,
      title: trimmedTitle,
      description: formState.description.trim() || null,
      category: formState.category.trim() || null,
      type: formState.type.trim() || null,
      base_price: priceValue,
      basePrice: priceValue,
      images,
      popular: Boolean(formState.popular),
      is_active: !formState.isHidden,
    };

    const assignedBranches = Array.isArray(formState.assignedBranches)
      ? formState.assignedBranches.filter(Boolean)
      : [];

    const sampleMode = usingSampleData || isSampleRestaurant(restaurant);

    if (!sampleMode && !restaurantId) {
      toast.error("Restaurant information is missing.");
      return;
    }

    payload.isVisible = !formState.isHidden;
    payload.available = !formState.isHidden;

    const branchAssignments = [];
    const branchInventories = [];
    for (const branchId of assignedBranches) {
      if (!branchId) continue;
      const branchExists = branches.some((branch) => branch.id === branchId);
      if (!branchExists) continue;

      const values = formState.branchInventory?.[branchId];
      let inventoryPayload = undefined;
      if (values) {
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

        const nextInventory = {};
        if (quantity !== null) nextInventory.quantity = quantity;
        if (reserved !== null) nextInventory.reserved_qty = reserved;
        if (Object.keys(nextInventory).length) {
          inventoryPayload = nextInventory;
        }
      }

      branchAssignments.push({
        branchId,
        isVisible: !formState.isHidden,
        isAvailable: true,
        inventory: inventoryPayload || null,
      });

      if (inventoryPayload) {
        branchInventories.push({
          branch_id: branchId,
          ...inventoryPayload,
        });
      }
    }

    if (branchAssignments.length) {
      payload.branch_assignments = branchAssignments;
    }
    if (branchInventories.length) {
      payload.branch_inventories = branchInventories;
    }

    const sanitizedOptionGroups = Array.isArray(formState.optionGroups)
      ? formState.optionGroups
          .map((group, index) => {
            const groupName = (group.name || "").trim();
            if (!groupName) return null;
            const items = (group.choices || [])
              .map((choice) => {
                const label = (choice.label || "").trim();
                if (!label) return null;
                const delta = Number(choice.priceDelta);
                return {
                  name: label,
                  description: null,
                  priceDelta: Number.isFinite(delta) ? delta : 0,
                  isActive: true,
                  displayOrder: choice.displayOrder ?? null,
                };
              })
              .filter(Boolean);
            if (!items.length) return null;
            const allowMultiple = Boolean(group.allowMultiple);
            const requiredGroup = Boolean(group.required);
            return {
              name: groupName,
              selectionType: allowMultiple ? "multiple" : "single",
              minSelect: requiredGroup ? 1 : 0,
              maxSelect: allowMultiple ? null : 1,
              isRequired: requiredGroup,
              items,
              displayOrder: index,
            };
          })
          .filter(Boolean)
      : [];

    const normalizedOptionGroupsForState = normalizeOptionGroupsForState(sanitizedOptionGroups);

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
                    optionGroups: normalizedOptionGroupsForState,
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
            previous.map((product) => {
              if (product.id !== activeProductId) return product;
              return decorateProductWithInventory({ ...product, ...updated });
            })
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
              branch_assignments: branchAssignments.map((assignment) => ({
                branch_id: assignment.branchId,
                is_visible: assignment.isVisible,
                is_available: assignment.isAvailable,
                quantity: assignment.inventory?.quantity ?? null,
                reserved_qty: assignment.inventory?.reserved_qty ?? null,
              })),
              optionGroups: normalizedOptionGroupsForState,
            };
            const decoratedNewProduct = decorateProductWithInventory(newProduct);
            setProducts((previous) => [...previous, decoratedNewProduct]);
            toast.success("Dish created.");
            shouldCloseModal = true;
          } else {
            const created = await ownerProductService.create(restaurantId, payload);
            if (created?.id && sanitizedOptionGroups.length) {
              let optionGroupFailures = 0;
              for (const [index, group] of sanitizedOptionGroups.entries()) {
                const optionPayload = {
                  ...group,
                  displayOrder: group.displayOrder ?? index,
                  items: group.items.map((item, itemIndex) => ({
                    ...item,
                    displayOrder: item.displayOrder ?? itemIndex,
                  })),
                };
                try {
                  // eslint-disable-next-line no-await-in-loop
                  await ownerProductService.createOptionGroup(
                    restaurantId,
                    created.id,
                    optionPayload,
                  );
                } catch (groupError) {
                  optionGroupFailures += 1;
                  console.error(groupError);
                }
              }
              if (optionGroupFailures) {
                toast.error(
                  `Dish saved but failed to create ${optionGroupFailures} option group${
                    optionGroupFailures > 1 ? "s" : ""
                  }.`,
                );
              }
            }
            const enrichedCreated =
              sanitizedOptionGroups.length > 0
                ? { ...created, optionGroups: normalizedOptionGroupsForState }
                : created;
            const decoratedCreated = decorateProductWithInventory(enrichedCreated);
            setProducts((previous) => [...previous, decoratedCreated]);
            setVisibilityOverrides((previous) => ({
              ...previous,
              [created.id]: formState.isHidden,
            }));
            toast.success("Dish created.");
          shouldRefresh = true;
          shouldCloseModal = true;
        }
      }

        if (shouldRefresh && restaurantId) {
          if (typeof refreshCatalog === "function") {
            await refreshCatalog();
          }
          await loadProducts(
            restaurantId,
            selectedBranchId !== "all" ? { branchId: selectedBranchId } : {},
          );
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
      setExpandedOptionRows((previous) =>
        (Array.isArray(previous) ? previous : []).filter((id) => id !== product.id),
      );
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
      setExpandedOptionRows((previous) =>
        (Array.isArray(previous) ? previous : []).filter((id) => id !== product.id),
      );
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
      productTitle: "",
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
            payload
          )
        )
      );
      const refreshed = await ownerProductService.fetchInventory(
        restaurant.id,
        inventoryModal.productId
      );
      const inventoryRecords = Array.isArray(refreshed) ? refreshed : [];
      setBranchInventoryCache((previous) => ({
        ...previous,
        [inventoryModal.productId]: inventoryRecords,
      }));

      const summary = buildInventorySummary(inventoryRecords);
      const recordsByBranch = inventoryRecords.reduce((acc, item) => {
        if (item?.branch_id) {
          acc[item.branch_id] = item;
        }
        return acc;
      }, {});
      setProducts((previous) =>
        previous.map((product) =>
          product.id === inventoryModal.productId
            ? {
              ...product,
              branch_assignments: Array.isArray(product.branch_assignments)
                ? product.branch_assignments.map((assignment) => {
                  const branchId = normalizeBranchId(assignment);
                  if (!branchId) return assignment;
                  const record = recordsByBranch[branchId];
                  if (!record) return assignment;
                  return {
                    ...assignment,
                    quantity: Number(record.quantity ?? 0),
                    reserved_qty: Number(record.reserved_qty ?? 0),
                  };
                })
                : product.branch_assignments,
              inventory_summary: summary,
            }
            : product
        )
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

  const toggleOptionRow = (productId) => {
    if (!productId) return;
    setExpandedOptionRows((previous) => {
      const list = Array.isArray(previous) ? [...previous] : [];
      if (list.includes(productId)) {
        return list.filter((id) => id !== productId);
      }
      return [...list, productId];
    });
  };

  const handleVisibilityToggle = (productId) => {
    const target = products.find((item) => item.id === productId);
    if (!target) return;

    // C?n ngo?c khi k?t h?p ?? v?i ||
    const currentHidden =
      visibilityOverrides[productId] ??
      (target.is_active === false || target.status === "hidden");

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

  const toggleNewCategoryBranch = (branchId) => {
    if (!branchId) return;
    if (!Array.isArray(branches) || !branches.some((branch) => branch.id === branchId)) return;
    setNewCategoryBranchIds((previous) => {
      const list = Array.isArray(previous) ? [...previous] : [];
      const index = list.indexOf(branchId);
      if (index >= 0) {
        list.splice(index, 1);
        return list;
      }
      return [...list, branchId];
    });
  };

  const selectAllNewCategoryBranches = () => {
    if (!Array.isArray(branches) || !branches.length) return;
    const ids = branches.map((branch) => branch.id).filter(Boolean);
    setNewCategoryBranchIds(ids);
  };

  const clearNewCategoryBranches = () => {
    setNewCategoryBranchIds([]);
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error("Category name cannot be empty.");
      return;
    }

    const sampleMode = usingSampleData || isSampleRestaurant(restaurant);

    const normalizedName = trimmed;
    const normalizedLower = normalizedName.toLowerCase();
    const existingNames = new Set(
      categoryNames.map((name) => name.toLowerCase()),
    );

    if (existingNames.has(normalizedLower)) {
      toast("Category already exists.");
      setNewCategoryName("");
      return;
    }

    if (sampleMode) {
      setCustomCategories((previous) => [...previous, normalizedName]);
      setApiCategories((previous) => [
        ...previous,
        {
          id: `sample-${normalizedLower.replace(/\s+/g, "-")}`,
          name: normalizedName,
          branchAssignments: [],
        },
      ]);
      toast.success("Category added (demo).");
      setNewCategoryName("");
      setNewCategoryBranchIds([]);
      return;
    }

    if (!restaurant?.id) {
      toast.error("Restaurant information missing.");
      return;
    }

    const availableBranches = Array.isArray(branches) ? branches : [];
    const selectedBranchIds = availableBranches.length
      ? newCategoryBranchIds.filter((id) =>
          availableBranches.some((branch) => branch.id === id),
        )
      : [];

    if (availableBranches.length && !selectedBranchIds.length) {
      toast.error("Select at least one branch to apply this category.");
      return;
    }

    const payload = { name: normalizedName };
    if (selectedBranchIds.length === 1) {
      payload.branchId = selectedBranchIds[0];
    } else if (selectedBranchIds.length > 1) {
      payload.branchIds = selectedBranchIds;
    }

    try {
      const created = await ownerProductService.createCategory(restaurant.id, payload);
      const resolvedName =
        (created && (created.name || created.label)) || normalizedName;
      const resolvedId = created?.id || created?.category_id || null;
      let resolvedAssignments = normalizeCategoryAssignments(
        created?.branch_assignments || created?.branchAssignments || []
      );
      if (!resolvedAssignments.length && selectedBranchIds.length) {
        resolvedAssignments = selectedBranchIds.map((branchId) => ({
          branch_id: branchId,
          is_visible: true,
          is_active: true,
          display_order: null,
        }));
      }
      setApiCategories((previous) => {
        if (previous.some((item) => item?.name?.toLowerCase() === resolvedName.toLowerCase())) {
          return previous.map((item) =>
            item?.name?.toLowerCase() === resolvedName.toLowerCase()
              ? { ...item, branchAssignments: resolvedAssignments }
              : item
          );
        }
        return [
          ...previous,
          {
            id: resolvedId,
            name: resolvedName,
            description: created?.description || null,
            productCount: Number(created?.productCount ?? created?.product_count ?? 0),
            branchAssignments: resolvedAssignments,
          },
        ];
      });
      toast.success("Category created.");
      setNewCategoryName("");
      setNewCategoryBranchIds(selectedBranchIds);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Unable to create category.";
      toast.error(message);
    }
  };

  const restaurantSelectValue =
    ownerRestaurants.length && ownerRestaurants.some((item) => item.id === selectedRestaurantId)
      ? selectedRestaurantId
      : ownerRestaurants.length
        ? ownerRestaurants[0].id
        : SAMPLE_RESTAURANT.id;

  const branchSelectDisabled = usingSampleData || !branches.length;
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const branchFilterLabel = usingSampleData
    ? "Showing demo data"
    : selectedBranchId === "all"
      ? "All branches"
      : `Branch: ${selectedBranch?.name || selectedBranch?.branch_name || "Selected branch"}`;

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
              className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
              type="button"
              onClick={openComboModal}
            >
              Add Combo
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
                {categoryNames.length ? (
                  categoryNames.map((category) => {
                    const apiCategory = apiCategories.find(
                      (item) => item?.name?.toLowerCase() === category.toLowerCase(),
                    );
                    const derivedCount = products.filter(
                      (product) => product.category === category,
                    ).length;
                    const productCount =
                      Number(apiCategory?.productCount ?? apiCategory?.product_count ?? 0) ||
                      derivedCount;
                    return (
                      <span
                        key={category}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-sm text-slate-700 shadow-sm"
                      >
                        {category}
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
                          {productCount}
                        </span>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm text-slate-500">No categories yet.</span>
                )}
              </div>
              <div className="space-y-4">
                {!usingSampleData && branches.length ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase text-slate-500">Apply to branches</span>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600">
                        <button
                          type="button"
                          className="rounded-md border border-emerald-200 px-2 py-1 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={selectAllNewCategoryBranches}
                          disabled={newCategoryBranchIds.length === branches.length}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={clearNewCategoryBranches}
                          disabled={!newCategoryBranchIds.length}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {branches.map((branch) => {
                        const branchId = branch.id;
                        const active = newCategoryBranchIds.includes(branchId);
                        return (
                          <button
                            key={branchId}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleNewCategoryBranch(branchId)}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
                              active
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 text-slate-600 hover:border-emerald-300"
                            }`}
                          >
                            <span
                              className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                                active ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                              }`}
                            >
                              {active ? "O" : ""}
                            </span>
                            {branch.name || branch.branch_name || "Unnamed branch"}
                          </button>
                        );
                      })}
                    </div>
                    {!newCategoryBranchIds.length ? (
                      <p className="text-[11px] text-amber-600">
                        Select one or more branches for this category.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                    onClick={handleAddCategory}
                    disabled={
                      !newCategoryName.trim() ||
                      (!usingSampleData && branches.length && !newCategoryBranchIds.length)
                    }
                  >
                    Add category
                  </button>
                </div>
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
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name or category"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-500">Category</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All</option>
                {categoryNames.map((category) => (
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
                onChange={(e) =>
                  setPriceRange((previous) => ({ ...previous, min: e.target.value }))
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
                onChange={(e) =>
                  setPriceRange((previous) => ({ ...previous, max: e.target.value }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
        </div>
        
      </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex min-w-[200px] flex-col">
            <span className="text-xs uppercase text-slate-500">Restaurant</span>
            {ownerRestaurants.length ? (
              <select
                value={restaurantSelectValue}
                onChange={(event) => handleRestaurantSelect(event.target.value)}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                {ownerRestaurants.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.restaurant_name || "Untitled restaurant"}
                  </option>
                ))}
              </select>
            ) : (
              <span className="mt-1 text-sm text-slate-500">Demo restaurant</span>
            )}
          </div>
          <div className="flex min-w-[180px] flex-col">
            <span className="text-xs uppercase text-slate-500">Branch</span>
            <select
              value={selectedBranchId}
              onChange={(event) => handleBranchFilterChange(event.target.value)}
              disabled={branchSelectDisabled}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="all">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name || branch.branch_name || "Unnamed branch"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{branchFilterLabel}</span>
            {productsLoading ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Loading…
              </span>
            ) : null}
          </div>
        </div>

        {usingSampleData && localCombos.length ? (
          <div className="mt-6 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-700">Draft combos</h3>
              <span className="text-xs font-medium text-emerald-600">
                {localCombos.length} {localCombos.length === 1 ? "combo" : "combos"}
              </span>
            </div>
            <ul className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {localCombos.map((combo) => (
                <li key={combo.id} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{combo.name}</span>
                    <span className="text-sm font-semibold text-emerald-700">
                      {formatCurrency(combo.price)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {combo.productIds.length}{" "}
                    {combo.productIds.length === 1 ? "product" : "products"} selected
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-emerald-600">
              Combos are stored locally while using demo data. Connect your restaurant to save them.
            </p>
          </div>
        ) : null}
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
                  const branchInventory =
                    selectedBranchId !== "all"
                      ? inventorySummary.byBranch?.[selectedBranchId] || null
                      : null;
                  const branchQuantity = Number(branchInventory?.quantity || 0);
                  const branchReserved = Number(branchInventory?.reserved_qty || 0);
                  const showBranchInventory = selectedBranchId !== "all";
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

                  const optionGroups = deriveOptionGroupsFromProduct(product);
                  const hasOptions = optionGroups.length > 0;
                  const expanded = hasOptions && expandedOptionRows.includes(product.id);
                  const optionSummary = hasOptions
                    ? optionGroups
                        .map((group) =>
                          `${group.name}${group.choices?.length ? ` (${group.choices.length})` : ""}`,
                        )
                        .join(" • ")
                    : "";

                  return (
                    <React.Fragment key={product.id}>
                      <tr className={`hover:bg-slate-50/60 ${expanded ? "bg-slate-50/60" : ""}`}>
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
                          <div className="flex items-start gap-3">
                            <div className="flex flex-1 flex-col">
                              <span className="font-semibold text-slate-900">{product.title}</span>
                              {product.description ? (
                                <span className="text-xs text-slate-500 line-clamp-2">
                                  {product.description}
                                </span>
                              ) : null}
                              {hasOptions ? (
                                <span className="mt-1 text-xs font-semibold text-emerald-600">
                                  {optionSummary}
                                </span>
                              ) : null}
                            </div>
                            {hasOptions ? (
                              <button
                                type="button"
                                aria-expanded={expanded}
                                aria-label={`${expanded ? "Hide" : "Show"} options for ${
                                  product.title
                                }`}
                                onClick={() => toggleOptionRow(product.id)}
                                className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.17l3.71-2.94a.75.75 0 0 1 .94 1.17l-4.24 3.36a.75.75 0 0 1-.94 0L5.25 8.27a.75.75 0 0 1-.02-1.06Z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
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
                            {showBranchInventory ? (
                              <>
                                <span className="font-semibold text-slate-800">
                                  {branchQuantity.toLocaleString("vi-VN")} in stock
                                </span>
                                <span className="text-xs text-slate-500">
                                  Reserved: {branchReserved.toLocaleString("vi-VN")}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Select a branch filter to view stock levels.
                              </span>
                            )}
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
                      {expanded ? (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="px-6 pb-6 pt-0">
                            <div className="space-y-4 border-t border-slate-200 pt-4">
                              {optionGroups.map((group) => (
                                <div key={`${product.id}-${group.id}`} className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-800">
                                      {group.name}
                                    </span>
                                    <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                      {group.required ? "Required" : "Optional"} •{" "}
                                      {group.allowMultiple ? "Multiple selection" : "Single selection"}
                                    </span>
                                  </div>
                                  {group.description ? (
                                    <p className="text-xs text-slate-500">{group.description}</p>
                                  ) : null}
                                  {Array.isArray(group.choices) && group.choices.length ? (
                                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      {group.choices.map((choice) => (
                                        <li
                                          key={`${group.id}-${choice.id}`}
                                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                                        >
                                          <span>{choice.label}</span>
                                          <span className="text-xs font-semibold text-slate-500">
                                            {formatPriceDeltaLabel(choice.priceDelta)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                      No choices configured for this option group.
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
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

      {/* G?i modal v?i d? props */}
      <DishFormModal
        open={modalOpen}
        mode={modalMode}
        form={{ ...emptyFormState, ...formState }}
        categoryOptions={categoryNames}
        branches={branches}
        branchInventory={formState.branchInventory || {}}
        inventoryReadonly={usingSampleData || isSampleRestaurant(restaurant)}
        onInventoryChange={handleFormBranchInventoryChange}
        onClose={closeModal}
        onChange={(changes) => setFormState((prev) => ({ ...prev, ...changes }))}
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
      <ComboModal
        open={comboModalOpen}
        form={comboForm}
        products={products}
        onClose={closeComboModal}
        onChange={(changes) => setComboForm((prev) => ({ ...prev, ...changes }))}
        onToggleProduct={toggleComboProduct}
        onSubmit={handleComboSubmit}
      />
    </div>
  );
};

export default MenuManagement;





