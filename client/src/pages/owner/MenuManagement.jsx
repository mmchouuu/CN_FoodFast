import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { assets } from "../../assets/data";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";
import ownerProductService from "../../services/ownerProducts";
import { dishPlaceholderImage } from "../../utils/imageHelpers";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const emptyFormState = {
  title: "",
  description: "",
  category: "",
  type: "",
  base_price: "",
  imageMode: "url",
  imageUrl: "",
  imagePreview: "",
  popular: false,
};


const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0đ";
  return `${numeric.toLocaleString("vi-VN")}đ`;
};

const buildFormFromDish = (dish) => {
  const firstImage =
    Array.isArray(dish?.images) && dish.images.length ? dish.images[0] : "";
  const inferredMode =
    typeof firstImage === "string" && firstImage.startsWith("data:")
      ? "upload"
      : "url";
  return {
    title: dish?.title || "",
    description: dish?.description || "",
    category: dish?.category || "",
    type: dish?.type || "",
    base_price:
      dish?.base_price === 0 || dish?.base_price
        ? String(Number(dish.base_price))
        : "",
    imageMode: inferredMode,
    imageUrl: inferredMode === "url" ? firstImage : "",
    imagePreview: firstImage || "",
    popular: Boolean(dish?.popular),
  };
};

const DishFormModal = ({
  open,
  mode,
  form,
  onClose,
  onChange,
  onSubmit,
  saving,
}) => {
  if (!open) return null;

  const handleModeChange = (nextMode) => {
    if (nextMode === form.imageMode) return;
    if (nextMode === "upload") {
      onChange({
        imageMode: "upload",
        imageUrl: "",
      });
    } else {
      onChange({
        imageMode: "url",
        imagePreview: form.imageUrl?.trim() || "",
      });
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn đúng định dạng ảnh.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() || "";
      onChange({
        imageMode: "upload",
        imagePreview: result,
        imageUrl: "",
      });
    };
    reader.onerror = () => toast.error("Không thể đọc file ảnh.");
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (value) => {
    onChange({
      imageMode: "url",
      imageUrl: value,
      imagePreview: value.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
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
            ✕
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={onSubmit}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              Dish name <span className="text-emerald-500">*</span>
            </span>
            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                onChange({ title: event.target.value ?? "" })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Pho Special"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              Category
            </span>
            <input
              type="text"
              value={form.category}
              onChange={(event) =>
                onChange({ category: event.target.value ?? "" })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Main Course"
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Description
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                onChange({ description: event.target.value ?? "" })
              }
              className="h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Key ingredients, serving size…"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              Base price (đ) <span className="text-emerald-500">*</span>
            </span>
            <input
              type="number"
              min="0"
              step="1000"
              value={form.base_price}
              onChange={(event) =>
                onChange({ base_price: event.target.value ?? "" })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="68000"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <input
              type="text"
              value={form.type}
              onChange={(event) =>
                onChange({ type: event.target.value ?? "" })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Standard"
            />
          </label>

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
                Dùng link ảnh
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${form.imageMode === "upload"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                onClick={() => handleModeChange("upload")}
              >
                Tải ảnh lên
              </button>
            </div>

            {form.imageMode === "url" ? (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Image URL</span>
                <input
                  type="url"
                  value={form.imageUrl ?? ""}
                  onChange={(event) => handleUrlChange(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="https://cdn.example.com/images/dish.jpg"
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">
                  Chọn ảnh từ máy
                </span>
                <input
                  key={form.imageMode}  // ⚡ reset input file mỗi khi đổi mode
                  type="file"
                  accept="image/*"
                  value={""}             // ⚡ LUÔN có value="" để controlled
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
                  className="h-32 w-full rounded-lg object-cover"
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
              checked={form.popular}
              onChange={(event) =>
                onChange({ ...form, popular: event.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">
              Mark as featured / popular item
            </span>
          </label>

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
  );
};

const MenuManagement = () => {
  const { restaurantProfile, refreshCatalog } = useAppContext();
  const ownerId = restaurantProfile?.id || null;

  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dishes, setDishes] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [formState, setFormState] = useState({ ...emptyFormState });
  const [activeDishId, setActiveDishId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadDishes = useCallback(async (restaurantId) => {
    try {
      const list = await ownerProductService.listByRestaurant(restaurantId);
      setDishes(Array.isArray(list) ? list : []);
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Không thể tải danh sách món ăn.";
      toast.error(message);
      setDishes([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!ownerId) {
      setLoading(false);
      setError("Bạn cần đăng nhập bằng tài khoản nhà hàng.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await restaurantManagerService.getByOwner(ownerId);
      if (!data || data.pending_profile) {
        setRestaurant(null);
        setDishes([]);
        setError("Vui lòng hoàn tất thông tin nhà hàng trước khi quản lý món.");
        return;
      }
      setRestaurant(data);
      await loadDishes(data.id);
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Không thể tải dữ liệu.";
      setError(message);
      setRestaurant(null);
      setDishes([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId, loadDishes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categories = useMemo(() => {
    const set = new Set(dishes.map((dish) => dish.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [dishes]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const matchSearch =
        !search ||
        dish.title?.toLowerCase().includes(search.toLowerCase()) ||
        dish.category?.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        categoryFilter === "all" ||
        !categoryFilter ||
        dish.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [dishes, search, categoryFilter]);

  const openCreateModal = () => {
    setModalMode("create");
    setFormState({ ...emptyFormState });
    setActiveDishId(null);
    setModalOpen(true);
  };

  const openEditModal = (dish) => {
    setModalMode("edit");
    setActiveDishId(dish.id);
    setFormState(buildFormFromDish(dish));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setFormState({ ...emptyFormState });
    setActiveDishId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!restaurant) return;

    const trimmedTitle = formState.title.trim();
    if (!trimmedTitle) {
      toast.error("Tên món ăn là bắt buộc.");
      return;
    }

    const numericPrice = Number(formState.base_price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      toast.error("Giá món ăn không hợp lệ.");
      return;
    }

    let images = [];
    if (formState.imageMode === "upload" && formState.imagePreview) {
      images = [formState.imagePreview];
    } else if (formState.imageMode === "url" && formState.imageUrl.trim()) {
      images = [formState.imageUrl.trim()];
    }

    const payload = {
      restaurant_id: restaurant.id,
      title: trimmedTitle,
      description: formState.description.trim() || null,
      category: formState.category.trim() || null,
      type: formState.type.trim() || null,
      base_price: numericPrice,
      images,
      popular: Boolean(formState.popular),
    };

    setSaving(true);
    try {
      if (modalMode === "edit" && activeDishId) {
        await ownerProductService.update(activeDishId, payload);
        toast.success("Cập nhật món ăn thành công.");
      } else {
        await ownerProductService.create(payload);
        toast.success("Thêm món ăn thành công.");
      }
      await refreshCatalog();
      await loadDishes(restaurant.id);
      closeModal();
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Không thể lưu món ăn.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dish) => {
    if (!restaurant) return;
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa món "${dish.title}"?`,
    );
    if (!confirmed) return;

    try {
      await ownerProductService.remove(dish.id);
      toast.success("Đã xóa món ăn.");
      await refreshCatalog();
      await loadDishes(restaurant.id);
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Không thể xóa món ăn.";
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className={containerClasses}>
        <p className="text-sm text-slate-500">Đang tải dữ liệu món ăn…</p>
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
    <div className={containerClasses}>
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dish Management</h1>
          <p className="text-sm text-slate-600">
            Manage menu items, pricing, and featured dishes in real time.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            type="button"
            onClick={() => toast("Tính năng đang được phát triển.")}
          >
            <img src={assets.uploadIcon} alt="" className="h-4 w-4" />
            Bulk Import
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
            type="button"
            onClick={openCreateModal}
          >
            <img src={assets.plus} alt="" className="h-4 w-4" />
            Add Dish
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <img src={assets.search} alt="search" className="h-4 w-4" />
              </span>
              <input
                type="search"
                placeholder="Search dishes..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
            <select
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === "all" ? "All categories" : category}
                </option>
              ))}
            </select>
            <div className="hidden sm:block" />
          </div>
          <div className="flex gap-3">
            <button
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
              type="button"
              onClick={loadData}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Image
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Dish
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Category
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Base Price
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDishes.length ? (
                filteredDishes.map((dish) => {
                  const statusLabel = dish.popular ? "Featured" : "Available";
                  const statusStyles = dish.popular
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700";
                  const primaryImage =
                    (Array.isArray(dish?.images) &&
                      dish.images.find((img) => typeof img === "string" && img)) ||
                    dish?.imagePreview ||
                    dish?.image ||
                    dish?.imageUrl ||
                    "";
                  const displayImage = primaryImage || dishPlaceholderImage;

                  return (
                    <tr key={dish.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          <img
                            src={displayImage}
                            alt={dish.title}
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
                          <span className="font-semibold text-slate-900">
                            {dish.title}
                          </span>
                          {dish.description ? (
                            <span className="text-xs text-slate-500 line-clamp-2">
                              {dish.description}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {dish.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {dish.type || "Standard"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {formatCurrency(dish.base_price)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                            type="button"
                            onClick={() => openEditModal(dish)}
                          >
                            Edit
                          </button>
                          <span className="h-4 w-px bg-slate-200" />
                          <button
                            className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                            type="button"
                            onClick={() => handleDelete(dish)}
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
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Chưa có món ăn nào. Hãy thêm món đầu tiên của bạn!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* <DishFormModal
        open={modalOpen}
        mode={modalMode}
        form={formState}
        onClose={closeModal}
        onChange={setFormState}
        onSubmit={handleSubmit}
        saving={saving}
      /> */}
      <DishFormModal
        open={modalOpen}
        mode={modalMode}
        form={{ ...emptyFormState, ...formState }}
        onClose={closeModal}
        onChange={(changes) => setFormState((prev) => ({ ...prev, ...changes }))}
        onSubmit={handleSubmit}
        saving={saving}
      />


    </div>
  );
};

export default MenuManagement;
