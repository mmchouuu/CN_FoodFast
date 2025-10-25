import React, { useEffect, useMemo, useState } from "react";
import { FaStar } from "react-icons/fa";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const BRANCHES_PER_PAGE = 4;

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const createDefaultHours = () =>
  Array.from({ length: 7 }, (_, index) => ({
    dayOfWeek: index,
    openTime: "08:00",
    closeTime: "22:00",
    isClosed: false,
    overnight: false,
  }));



const emptyRestaurantForm = {
  name: "",
  description: "",
  about: "",
  cuisine: "",
  phone: "",
  email: "",
  logoUrl: "",
  coverPhoto: "",
};

const buildBranchForm = (nextNumber, preset = {}) => {
  const rawImage = preset.imageUrl || "";
  const isDataUri = typeof rawImage === "string" && rawImage.startsWith("data:image");
  return {
    id: preset.id || null,
    name: preset.name || "",
    branchNumber: String(preset.branchNumber ?? nextNumber),
    branchPhone: preset.branchPhone || preset.brandPhone || "",
    branchEmail: preset.branchEmail || preset.brandEmail || "",
    street: preset.street || "",
    ward: preset.ward || "",
    district: preset.district || "",
    city: preset.city || "",
    latitude:
      preset.latitude !== undefined && preset.latitude !== null ? String(preset.latitude) : "",
    longitude:
      preset.longitude !== undefined && preset.longitude !== null ? String(preset.longitude) : "",
    imageUrl: rawImage,
    imageSource: rawImage ? (isDataUri ? "file" : "url") : "none",
    isPrimary: Boolean(preset.isPrimary),
    isOpen: Boolean(preset.isOpen),
  };
};

const mapRestaurantData = (raw) => {
  if (!raw) return null;
  const logoUrl = Array.isArray(raw.logo) && raw.logo.length ? raw.logo[0] : raw.logoUrl || "";
  const coverPhoto = Array.isArray(raw.images) && raw.images.length ? raw.images[0] : raw.coverPhoto || "";
  return {
    ...raw,
    logoUrl,
    coverPhoto,
  };
};

const mapBranchData = (branch) => {
  if (!branch) return null;
  const images = Array.isArray(branch.images) ? branch.images : null;
  const imageUrl = images && images.length ? images[0] : branch.imageUrl || "";
  const phone = branch.branchPhone ?? branch.brandPhone ?? "";
  const email = branch.branchEmail ?? branch.brandEmail ?? "";
  const branchNumber = Number(branch.branchNumber ?? branch.branch_number ?? 0) || 0;
  return {
    ...branch,
    branchNumber,
    branchPhone: phone,
    branchEmail: email,
    imageUrl,
    openingHours: Array.isArray(branch.openingHours) ? branch.openingHours : [],
    specialHours: Array.isArray(branch.specialHours) ? branch.specialHours : [],
  };
};

const buildRestaurantFormFromData = (restaurant) => ({
  name: restaurant?.name || "",
  description: restaurant?.description || "",
  about: restaurant?.about || "",
  cuisine: restaurant?.cuisine || "",
  phone: restaurant?.phone || "",
  email: restaurant?.email || "",
  logoUrl: restaurant?.logoUrl || "",
  coverPhoto: restaurant?.coverPhoto || "",
});

const formatOpeningSchedule = (openingHours = []) => {
  if (!Array.isArray(openingHours) || !openingHours.length) {
    return "Schedule not set";
  }

  const normalised = openingHours
    .filter((item) => item && Number.isInteger(item.dayOfWeek))
    .map((item) => ({
      dayOfWeek: Number(item.dayOfWeek),
      isClosed: item.isClosed === true,
      openTime: item.openTime || "",
      closeTime: item.closeTime || "",
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  if (!normalised.length) return "Schedule not set";

  const groups = [];
  normalised.forEach((item) => {
    const label = item.isClosed
      ? "Closed"
      : `${item.openTime || "--:--"} - ${item.closeTime || "--:--"}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label && item.dayOfWeek === last.end + 1) {
      last.end = item.dayOfWeek;
    } else {
      groups.push({ start: item.dayOfWeek, end: item.dayOfWeek, label });
    }
  });

  return groups
    .map(({ start, end, label }) => {
      const days = start === end ? DAY_LABELS[start] : `${DAY_LABELS[start]} - ${DAY_LABELS[end]}`;
      return `${days}: ${label}`;
    })
    .join("; ");
};

const RestaurantProfile = () => {
  const { restaurantProfile } = useAppContext();
  const ownerId = restaurantProfile?.id || null;

  const [restaurant, setRestaurant] = useState(null);
  const [branches, setBranches] = useState([]);
  const [viewMode, setViewMode] = useState(ownerId ? "loading" : "createRestaurant");
  const [editingBranchId, setEditingBranchId] = useState(null);

  const [branchSearch, setBranchSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurantForm);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");

  const [branchForm, setBranchForm] = useState(() => buildBranchForm(1));
  const [branchImagePreview, setBranchImagePreview] = useState("");
  const [branchImageFileName, setBranchImageFileName] = useState("");
  const [openingHours, setOpeningHours] = useState(createDefaultHours);
  const [specialHours, setSpecialHours] = useState([]);
  const [specialEnabled, setSpecialEnabled] = useState(false);

  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState("");
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);

  const restaurantExists = Boolean(restaurant && restaurant.id);

  useEffect(() => {
    let cancelled = false;

    if (!ownerId) {
      setRestaurant(null);
      setBranches([]);
      setRestaurantForm(emptyRestaurantForm);
      setLogoPreview("");
      setCoverPreview("");
      setViewMode("createRestaurant");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await restaurantManagerService.getByOwner(ownerId);
        if (cancelled) return;
        if (!data) {
          setRestaurant(null);
          setBranches([]);
          setRestaurantForm(emptyRestaurantForm);
          setLogoPreview("");
          setCoverPreview("");
          setViewMode("createRestaurant");
          return;
        }
        const mappedRestaurant = mapRestaurantData(data);
        const mappedBranches = Array.isArray(data.branches)
          ? data.branches.map((branch) => mapBranchData(branch)).filter(Boolean)
          : [];
        setRestaurant(mappedRestaurant);
        setBranches(mappedBranches);
        setRestaurantForm(buildRestaurantFormFromData(mappedRestaurant));
        setLogoPreview(mappedRestaurant.logoUrl || "");
        setCoverPreview(mappedRestaurant.coverPhoto || "");
        setViewMode(data.pending_profile ? "createRestaurant" : "summary");
      } catch (err) {
        if (cancelled) return;
        const message = err?.response?.data?.message || err?.message || "Unable to load restaurant profile.";
        setError(message);
        setRestaurant(null);
        setBranches([]);
        setRestaurantForm(emptyRestaurantForm);
        setLogoPreview("");
        setCoverPreview("");
        setViewMode("createRestaurant");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [ownerId]);
  const showBranchForm = viewMode === "createBranch" || viewMode === "editBranch";

  const handleRestaurantTextChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setRestaurantForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRestaurantFileChange = (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString() || "";
      setRestaurantForm((prev) => ({ ...prev, [field]: result }));
      if (field === "logoUrl") setLogoPreview(result);
      if (field === "coverPhoto") setCoverPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRestaurantSubmit = async (event) => {
    event.preventDefault();
    if (!ownerId) {
      setError("Please sign in with a restaurant account first.");
      return;
    }
    if (!restaurantForm.name.trim()) {
      setError("Restaurant name is required.");
      return;
    }

    const payload = {
      ownerId,
      name: restaurantForm.name.trim(),
      description: restaurantForm.description.trim(),
      about: restaurantForm.about.trim(),
      cuisine: restaurantForm.cuisine.trim(),
      phone: restaurantForm.phone.trim(),
      email: restaurantForm.email.trim(),
      logo: restaurantForm.logoUrl ? [restaurantForm.logoUrl] : [],
      images: restaurantForm.coverPhoto ? [restaurantForm.coverPhoto] : [],
    };

    setSavingRestaurant(true);
    setError("");
    try {
      let response;
      if (restaurantExists) {
        response = await restaurantManagerService.updateRestaurant(restaurant.id, payload);
      } else {
        response = await restaurantManagerService.createRestaurant(payload);
      }
      const mappedRestaurant = mapRestaurantData(response);
      const mappedBranches = Array.isArray(response?.branches)
        ? response.branches.map((branch) => mapBranchData(branch))
        : branches;
      setRestaurant(mappedRestaurant);
      setBranches(mappedBranches);
      setRestaurantForm(buildRestaurantFormFromData(mappedRestaurant));
      setLogoPreview(mappedRestaurant.logoUrl || "");
      setCoverPreview(mappedRestaurant.coverPhoto || "");
      setViewMode("summary");
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Unable to save restaurant.";
      setError(message);
    } finally {
      setSavingRestaurant(false);
    }
  };

  const resetBranchState = (preset = {}) => {
    const normalised =
      preset && Object.keys(preset).length ? mapBranchData(preset) || {} : {};
    const nextNumber =
      normalised.branchNumber ||
      (branches.length
        ? Math.max(...branches.map((branch) => Number(branch.branchNumber) || 0)) + 1
        : 1);
    const initialImage = normalised.imageUrl || "";
    const isDataUri = typeof initialImage === "string" && initialImage.startsWith("data:image");
    setBranchImagePreview(initialImage);
    setBranchImageFileName(isDataUri ? "Existing uploaded image" : "");
    setBranchForm(buildBranchForm(nextNumber, normalised));
    setOpeningHours(
      normalised.openingHours && normalised.openingHours.length
        ? normalised.openingHours.map((item) => ({ ...item }))
        : createDefaultHours(),
    );
    setSpecialHours(
      normalised.specialHours && normalised.specialHours.length
        ? normalised.specialHours.map((item) => ({ ...item }))
        : [],
    );
    setSpecialEnabled(Boolean(normalised.specialHours && normalised.specialHours.length));
  };

  const startCreateBranch = () => {
    setEditingBranchId(null);
    resetBranchState();
    setError("");
    setViewMode("createBranch");
  };

  const startEditBranch = (branch) => {
    setEditingBranchId(branch.id);
    resetBranchState(branch);
    setError("");
    setViewMode("editBranch");
  };

  const handleBranchFieldChange = (event) => {
    const { name, type, value, checked } = event.target;
    setError("");
    if (name === "imageUrl") {
      const trimmed = value.trim();
      setBranchForm((prev) => ({
        ...prev,
        imageUrl: trimmed,
        imageSource: trimmed ? "url" : "none",
      }));
      setBranchImagePreview(trimmed || "");
      setBranchImageFileName("");
      return;
    }
    setBranchForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleBranchImageFileChange = (event) => {
    const file = event.target.files?.[0];
    setError("");
    if (!file) {
      return;
    }
    if (file && file.type && !file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString() || "";
      setBranchForm((prev) => ({
        ...prev,
        imageUrl: result,
        imageSource: result ? "file" : "none",
      }));
      setBranchImagePreview(result);
      setBranchImageFileName(file.name || "Uploaded image");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleBranchImageClear = () => {
    setError("");
    setBranchForm((prev) => ({
      ...prev,
      imageUrl: "",
      imageSource: "none",
    }));
    setBranchImagePreview("");
    setBranchImageFileName("");
  };

  const handleOpeningHourChange = (index, field, value) => {
    setOpeningHours((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === "isClosed") {
          const nextClosed = Boolean(value);
          return {
            ...item,
            isClosed: nextClosed,
            openTime: nextClosed ? "" : item.openTime || "08:00",
            closeTime: nextClosed ? "" : item.closeTime || "22:00",
          };
        }
        if (field === "overnight") {
          return { ...item, overnight: Boolean(value) };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const addSpecialHour = () => {
    setSpecialHours((prev) => [
      ...prev,
      {
        date: "",
          openTime: "",
          closeTime: "",
          isClosed: false,
          overnight: false,
          note: "",
      },
    ]);
  };
  const handleSpecialHoursToggle = (checked) => {
    const next = Boolean(checked);
    setSpecialEnabled(next);
    if (!next) {
      setSpecialHours([]);
    } else if (!specialHours.length) {
      setSpecialHours([
        {
          date: "",
          openTime: "",
          closeTime: "",
          isClosed: false,
          overnight: false,
          note: "",
        },
      ]);
    }
  };

  const updateSpecialHour = (index, field, value) => {
    setSpecialHours((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === "isClosed") {
          const nextClosed = Boolean(value);
          return {
            ...item,
            isClosed: nextClosed,
            openTime: nextClosed ? "" : item.openTime || "",
            closeTime: nextClosed ? "" : item.closeTime || "",
          };
        }
        if (field === "overnight") {
          return { ...item, overnight: Boolean(value) };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const removeSpecialHour = (index) => {
    setSpecialHours((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleBranchSubmit = async (event) => {
    event.preventDefault();
    if (!restaurantExists) {
      setError("Create the restaurant profile before adding a branch.");
      return;
    }
    const branchNumber = Number(branchForm.branchNumber) || branches.length + 1;
    const imageValue =
      branchForm.imageSource === "url"
        ? branchForm.imageUrl.trim()
        : branchForm.imageSource === "file"
        ? branchForm.imageUrl
        : "";

    const payload = {
      name: branchForm.name.trim() || `Branch #${branchNumber}`,
      branchNumber,
      branchPhone: branchForm.branchPhone.trim(),
      branchEmail: branchForm.branchEmail.trim(),
      street: branchForm.street.trim(),
      ward: branchForm.ward.trim(),
      district: branchForm.district.trim(),
      city: branchForm.city.trim(),
      latitude: branchForm.latitude ? Number(branchForm.latitude) : null,
      longitude: branchForm.longitude ? Number(branchForm.longitude) : null,
      images: imageValue ? [imageValue] : [],
      isPrimary: branchForm.isPrimary,
      isOpen: branchForm.isOpen,
      openingHours: openingHours.map((item) => ({ ...item })),
      specialHours: specialEnabled
        ? specialHours
            .filter((item) => item.date)
            .map((item) => ({ ...item }))
        : [],
    };

    setSavingBranch(true);
    setError("");
    try {
      let updatedBranch;
      if (editingBranchId) {
        updatedBranch = await restaurantManagerService.updateBranch(
          restaurant.id,
          editingBranchId,
          payload,
        );
      } else {
        updatedBranch = await restaurantManagerService.createBranch(restaurant.id, payload);
      }
      const mappedBranch = mapBranchData(updatedBranch);
      setBranches((prev) => {
        const base = editingBranchId
          ? prev.map((branch) => (branch.id === editingBranchId ? mappedBranch : branch))
          : [...prev, mappedBranch];
        if (mappedBranch.isPrimary) {
          return base.map((branch) => ({
            ...branch,
            isPrimary: branch.id === mappedBranch.id,
          }));
        }
        return base;
      });
      setEditingBranchId(null);
      resetBranchState();
      setViewMode("summary");
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Unable to save branch.";
      setError(message);
    } finally {
      setSavingBranch(false);
    }
  };

  const handleToggleBranchStatus = async (branchId) => {
    if (!restaurantExists) return;
    const target = branches.find((branch) => branch.id === branchId);
    if (!target) return;
    const nextStatus = !target.isOpen;
    try {
      const updated = await restaurantManagerService.updateBranch(restaurant.id, branchId, {
        isOpen: nextStatus,
      });
      const mapped = mapBranchData(updated);
      setBranches((prev) =>
        prev.map((branch) => (branch.id === branchId ? mapped : branch)),
      );
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Unable to update branch status.";
      setError(message);
    }
  };

  const filteredBranches = useMemo(() => {
    const term = branchSearch.trim().toLowerCase();
    return branches
      .slice()
      .sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return a.branchNumber - b.branchNumber;
      })
      .filter((branch) => {
        const matchesSearch = term
          ? [branch.name, String(branch.branchNumber), branch.branchPhone, branch.branchEmail, branch.street, branch.ward, branch.district, branch.city]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(term))
          : true;

        let matchesFilter = true;
        switch (branchFilter) {
          case "primary":
            matchesFilter = branch.isPrimary;
            break;
          case "secondary":
            matchesFilter = !branch.isPrimary;
            break;
          case "open":
            matchesFilter = branch.isOpen;
            break;
          case "closed":
            matchesFilter = !branch.isOpen;
            break;
          default:
            matchesFilter = true;
        }
        return matchesSearch && matchesFilter;
      });
  }, [branches, branchFilter, branchSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / BRANCHES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBranches = useMemo(() => {
    const start = (safePage - 1) * BRANCHES_PER_PAGE;
    return filteredBranches.slice(start, start + BRANCHES_PER_PAGE);
  }, [filteredBranches, safePage]);

  const rangeStart = filteredBranches.length ? (safePage - 1) * BRANCHES_PER_PAGE + 1 : 0;
  const rangeEnd = filteredBranches.length ? Math.min(safePage * BRANCHES_PER_PAGE, filteredBranches.length) : 0;

  const canCreateRestaurant = !loading && !restaurantExists;

  if (!ownerId) {
    return (
      <div className={containerClasses}>
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-600 shadow-sm">
          Sign in with your restaurant account to manage profile and branches.
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Restaurant information</h1>
          <p className="text-sm text-slate-600">Manage your brand profile and its branches in one place.</p>
        </div>
        {canCreateRestaurant ? (
          <button
            type="button"
            onClick={() => setViewMode("createRestaurant")}
            className="rounded-lg border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
          >
            Create new restaurant
          </button>
        ) : null}
      </header>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          {viewMode === "createRestaurant" ? (
            <RestaurantForm
              form={restaurantForm}
              logoPreview={logoPreview}
              coverPreview={coverPreview}
              isSubmitting={savingRestaurant}
              onChange={handleRestaurantTextChange}
              onFileChange={handleRestaurantFileChange}
              onSubmit={handleRestaurantSubmit}
              onCancel={() => setViewMode("summary")}
            />
          ) : restaurantExists ? (
            <>
              <RestaurantSummary
                restaurant={restaurant}
                onEdit={() => {
                  setRestaurantForm(buildRestaurantFormFromData(restaurant));
                  setLogoPreview(restaurant.logoUrl || "");
                  setCoverPreview(restaurant.coverPhoto || "");
                  setViewMode("createRestaurant");
                }}
                onCreateBranch={startCreateBranch}
              />
              <RestaurantHero restaurant={restaurant} branches={branches} />
            </>
          ) : (
            <EmptyState onCreate={() => setViewMode("createRestaurant")} />
          )}

          {restaurantExists ? (
            <BranchManagement
              branches={paginatedBranches}
              branchCount={filteredBranches.length}
              branchRangeStart={rangeStart}
              branchRangeEnd={rangeEnd}
              totalPages={totalPages}
              currentPage={safePage}
              branchSearch={branchSearch}
              branchFilter={branchFilter}
              showForm={showBranchForm}
              branchForm={branchForm}
              openingHours={openingHours}
              specialHours={specialHours}
              specialEnabled={specialEnabled}
              isSubmittingBranch={savingBranch}
              onSearchChange={(value) => {
                setBranchSearch(value);
                setCurrentPage(1);
              }}
              onFilterChange={(value) => {
                setBranchFilter(value);
                setCurrentPage(1);
              }}
              onResetFilters={() => {
                setBranchSearch("");
                setBranchFilter("all");
                setCurrentPage(1);
              }}
              onPageChange={setCurrentPage}
              onCreateBranch={startCreateBranch}
              onEditBranch={startEditBranch}
              onCancelForm={() => {
                resetBranchState();
                setEditingBranchId(null);
                setViewMode("summary");
              }}
              imagePreview={branchImagePreview}
              imageFileName={branchImageFileName}
              onImageFileChange={handleBranchImageFileChange}
              onImageClear={handleBranchImageClear}
              onBranchFieldChange={handleBranchFieldChange}
              onOpeningHourChange={handleOpeningHourChange}
              onSpecialToggle={handleSpecialHoursToggle}
              onAddSpecialHour={addSpecialHour}
              onUpdateSpecialHour={updateSpecialHour}
              onRemoveSpecialHour={removeSpecialHour}
              onSubmitBranch={handleBranchSubmit}
              onToggleBranchStatus={handleToggleBranchStatus}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};
const EmptyState = ({ onCreate }) => (
  <section className="rounded-2xl border border-dashed border-emerald-300 bg-white p-6 text-center shadow-sm">
    <h2 className="text-xl font-semibold text-slate-900">No restaurant profile yet</h2>
    <p className="mt-2 text-sm text-slate-600">
      Create your brand profile to showcase restaurant details and manage branches.
    </p>
    <button
      type="button"
      onClick={onCreate}
      className="mt-4 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
    >
      Create new restaurant
    </button>
  </section>
);
const ErrorBanner = ({ message, onDismiss }) => (
  <div className="mb-6 flex items-start justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
    <span>{message}</span>
    {onDismiss ? (
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-semibold uppercase tracking-wide text-rose-600 hover:text-rose-700"
      >
        Dismiss
      </button>
    ) : null}
  </div>
);

const LoadingState = () => (
  <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-600 shadow-sm">
    Loading restaurant data...
  </div>
);

const RestaurantForm = ({ form, logoPreview, coverPreview, onChange, onFileChange, onSubmit, onCancel, isSubmitting }) => (
  <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
    <header className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Manage restaurant profile</h2>
        <p className="text-sm text-slate-600">
          Provide the base information for your restaurant. Upload images from your device or paste a link from the web.
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        Cancel
      </button>
    </header>
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput
          name="name"
          label="Restaurant name"
          value={form.name}
          onChange={onChange}
          required
        />
        <FieldInput
          name="cuisine"
          label="Cuisine"
          placeholder="Vietnamese Fusion"
          value={form.cuisine}
          onChange={onChange}
        />
        <FieldInput
          name="phone"
          label="Hotline"
          placeholder="+84 ..."
          value={form.phone}
          onChange={onChange}
        />
        <FieldInput
          name="email"
          label="Email"
          type="email"
          placeholder="contact@restaurant.com"
          value={form.email}
          onChange={onChange}
        />
      </div>
      <FieldInput
        name="description"
        label="Short description"
        as="textarea"
        rows={3}
        placeholder="Introduce your brand, signature dishes, or ambiance."
        value={form.description}
        onChange={onChange}
      />
      <FieldInput
        name="about"
        label="About / Story"
        as="textarea"
        rows={4}
        placeholder="Share the story of your restaurant, chef, and dining experience."
        value={form.about}
        onChange={onChange}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <SectionTitle
            title="Logo"
            subtitle="Ideal aspect ratio 1:1. Upload or paste a direct image URL."
          />
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-xl border border-dashed border-emerald-200 bg-emerald-50">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-emerald-500">
                  Logo
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50">
                Upload device image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => onFileChange(event, "logoUrl")}
                />
              </label>
              <input
                name="logoUrl"
                value={form.logoUrl}
                onChange={onChange}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <SectionTitle
            title="Cover photo"
            subtitle="Displayed in the restaurant hero section. Upload landscape images."
          />
          <div className="h-32 w-full overflow-hidden rounded-xl border border-dashed border-emerald-200 bg-emerald-50">
            {coverPreview ? (
              <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-emerald-500">
                Cover image
              </div>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50">
            Upload cover image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onFileChange(event, "coverPhoto")}
            />
          </label>
          <input
            name="coverPhoto"
            value={form.coverPhoto}
            onChange={onChange}
            placeholder="https://example.com/cover.jpg"
            className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Save restaurant"}
        </button>
      </div>
    </form>
  </section>
);
const RestaurantSummary = ({ restaurant, onEdit, onCreateBranch }) => (
  <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {restaurant.logoUrl ? (
            <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Logo</div>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{restaurant.name}</h2>
            <p className="text-sm text-slate-600">
              {restaurant.cuisine ? `${restaurant.cuisine} cuisine` : "Cuisine not specified"}
            </p>
          </div>
          <p className="text-sm text-slate-600">
            {restaurant.about || restaurant.description || "Tell guests about your concept, chef, and experience."}
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">Hotline:</span>
              {restaurant.phone || "Updating"}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">Email:</span>
              {restaurant.email || "Updating"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onCreateBranch}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Create branch
        </button>
      </div>
    </div>
  </section>
);

const RestaurantHero = ({ restaurant, branches }) => (
  <section className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-r p-[1px] shadow-lg">
    <div className="relative flex flex-col gap-6 rounded-[calc(theme(borderRadius.2xl)-1px)] bg-white/95 p-6 backdrop-blur">
      <div className="relative h-48 w-full overflow-hidden rounded-xl bg-slate-100">
        {restaurant.coverPhoto ? (
          <>
            <img src={restaurant.coverPhoto} alt="Restaurant cover" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-500">
            Upload a cover photo to preview it here.
          </div>
        )}
        <div className="absolute bottom-4 left-4 text-white">
          <p className="text-sm uppercase tracking-wide text-white/80">Hero preview</p>
          <h3 className="text-2xl font-semibold">{restaurant.name}</h3>
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-slate-900">About this restaurant</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            {restaurant.about ||
              restaurant.description ||
              "Use this space to highlight chef stories, best sellers, or dining experiences. The values come directly from your restaurant profile."}
          </p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const tags =
                Array.isArray(restaurant.tags) && restaurant.tags.length
                  ? restaurant.tags
                  : restaurant.cuisine
                  ? [restaurant.cuisine]
                  : [];
              return tags.length ? (
                tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">Add tags to highlight dining options.</span>
              );
            })()}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <HeroStat label="Branches" value={branches.length} />
          <HeroStat label="Primary branch" value={branches.find((branch) => branch.isPrimary)?.name || "Not set"} />
          <HeroStat
            label="Average rating"
            value={(() => {
              const ratedValues = branches
                .map((branch) => Number(branch.ratingSummary?.avgRating ?? branch.rating ?? 0))
                .filter((value) => Number.isFinite(value) && value > 0);
              if (!ratedValues.length) return "0.0";
              const avg = ratedValues.reduce((sum, value) => sum + value, 0) / ratedValues.length;
              return avg.toFixed(1);
            })()}
          />
        </div>
      </div>
    </div>
  </section>
);

const HeroStat = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
  </div>
);
const BranchManagement = ({
  branches,
  branchCount,
  branchRangeStart,
  branchRangeEnd,
  totalPages,
  currentPage,
  branchSearch,
  branchFilter,
  showForm,
  branchForm,
  openingHours,
  specialHours,
  specialEnabled,
  imagePreview,
  imageFileName,
  isSubmittingBranch,
  onSearchChange,
  onFilterChange,
  onResetFilters,
  onPageChange,
  onCreateBranch,
  onEditBranch,
  onCancelForm,
  onImageFileChange,
  onImageClear,
  onBranchFieldChange,
  onOpeningHourChange,
  onSpecialToggle,
  onAddSpecialHour,
  onUpdateSpecialHour,
  onRemoveSpecialHour,
  onSubmitBranch,
  onToggleBranchStatus,
}) => (
  <section className="space-y-6">
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
          <input
            value={branchSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search branches by name, contact or location..."
            className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            type="search"
          />
          <select
            value={branchFilter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 md:w-44"
          >
            <option value="all">All branches</option>
            <option value="primary">Primary only</option>
            <option value="secondary">Secondary branches</option>
            <option value="open">Open now</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">
            {branchCount
              ? `Showing ${branchRangeStart}-${branchRangeEnd} of ${branchCount} branches`
              : "No branches available"}
          </span>
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Reset filters
          </button>
          <button
            type="button"
            onClick={onCreateBranch}
            disabled={showForm}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create new branch
          </button>
        </div>
      </div>
    </div>

    {showForm ? (
      <BranchForm
        form={branchForm}
        openingHours={openingHours}
        specialHours={specialHours}
        specialEnabled={specialEnabled}
        imagePreview={imagePreview}
        imageFileName={imageFileName}
        onFieldChange={onBranchFieldChange}
        onImageFileChange={onImageFileChange}
        onImageClear={onImageClear}
        onOpeningHourChange={onOpeningHourChange}
        onSpecialToggle={onSpecialToggle}
        onAddSpecialHour={onAddSpecialHour}
        onUpdateSpecialHour={onUpdateSpecialHour}
        onRemoveSpecialHour={onRemoveSpecialHour}
        onSubmit={onSubmitBranch}
        isSubmitting={isSubmittingBranch}
        onCancel={onCancelForm}
      />
    ) : null}

    <div className="grid gap-4">
      {branches.length ? (
        branches.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            onToggleStatus={() => onToggleBranchStatus(branch.id)}
            onEdit={() => onEditBranch(branch)}
          />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No branches match the current filters. Try adjusting search keywords or filter options.
        </div>
      )}
    </div>

    {totalPages > 1 ? (
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-sm md:flex-row md:items-center md:justify-between">
        <span className="text-xs text-slate-500">Page {currentPage} of {totalPages}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    ) : null}
  </section>
);
const BranchCard = ({ branch, onToggleStatus, onEdit }) => {
  const statusDot = branch.isOpen ? "bg-emerald-500" : "bg-rose-500";
  const statusLabel = branch.isOpen ? "Open now" : "Closed";
  const badgeLabel = branch.isPrimary ? "Primary" : `Branch ${branch.branchNumber}`;
  const coords = (() => {
    const lat = branch.latitude != null ? Number(branch.latitude).toFixed(4) : null;
    const lon = branch.longitude != null ? Number(branch.longitude).toFixed(4) : null;
    if (lat && lon) return `${lat}, ${lon}`;
    if (lat) return lat;
    if (lon) return lon;
    return "...";
  })();
  const schedule = formatOpeningSchedule(branch.openingHours);
  const ratingValue = Number(
    branch.ratingSummary?.avgRating ?? branch.rating ?? branch.ratingSummary?.avg_branch_rating ?? 0,
  );
  const ratingCount = Number(branch.ratingSummary?.totalRatings ?? branch.totalRatings ?? 0);

  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
      <span
        className={`absolute right-4 top-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
          branch.isPrimary ? "bg-amber-400 text-amber-900" : "bg-slate-100 text-slate-600"
        }`}
      >
        {badgeLabel}
      </span>
      <div className="flex items-center gap-4">
        <div className="h-28 w-36 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {branch.imageUrl ? (
            <img src={branch.imageUrl} alt={branch.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Branch image</div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{branch.name}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-500">{badgeLabel}</p>
          </div>
          <div className="grid gap-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">Phone:</span>
              {branch.branchPhone || "Updating"}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">Email:</span>
              {branch.branchEmail || "Updating"}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">Address:</span>
              {[branch.street, branch.ward, branch.district, branch.city].filter(Boolean).join(", ") || "Updating"}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">Coordinates:</span>
              {coords}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">Schedule:</span>
              {schedule}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 lg:items-end">
        <RatingBadge rating={ratingValue} count={ratingCount} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleStatus}
            className="rounded-lg border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
          >
            {branch.isOpen ? "Mark as closed" : "Mark as open"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Edit branch
          </button>
        </div>
      </div>
    </div>
  );
};

const RatingBadge = ({ rating, count = 0 }) => {
  const display = Number.isFinite(rating) && rating > 0 ? rating : 0;
  const stars = Array.from({ length: 5 }, (_, index) => index + 1);
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
      <span className="flex items-center gap-1">
        {stars.map((star) => (
          <FaStar key={star} className={star <= display ? "text-amber-400" : "text-slate-300"} />
        ))}
      </span>
      <span>{display.toFixed(1)}</span>
      <span className="text-amber-500">({count})</span>
    </div>
  );
};
const BranchForm = ({
  form,
  openingHours,
  specialHours,
  specialEnabled,
  imagePreview,
  imageFileName,
  onFieldChange,
  onImageFileChange,
  onImageClear,
  onOpeningHourChange,
  onSpecialToggle,
  onAddSpecialHour,
  onUpdateSpecialHour,
  onRemoveSpecialHour,
  onSubmit,
  isSubmitting,
  onCancel,
}) => (
  <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
    <header className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{form.id ? "Edit branch" : "Create branch"}</h2>
        <p className="text-sm text-slate-600">
          Map the fields to restaurant_branches, branch_opening_hours, and branch_special_hours tables.
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        Cancel
      </button>
    </header>
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput
          name="name"
          label="Branch name"
          value={form.name}
          onChange={onFieldChange}
          required
        />
        <FieldInput
          name="branchNumber"
          label="Branch number"
          type="number"
          min="1"
          value={form.branchNumber}
          onChange={onFieldChange}
        />
        <FieldInput
          name="branchPhone"
          label="Branch phone"
          value={form.branchPhone}
          onChange={onFieldChange}
          placeholder="+84 ..."
        />
        <FieldInput
          name="branchEmail"
          label="Branch email"
          type="email"
          value={form.branchEmail}
          onChange={onFieldChange}
          placeholder="branch@example.com"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Branch image
          </label>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
            <input
              type="url"
              name="imageUrl"
              value={form.imageSource === "file" ? "" : form.imageUrl}
              onChange={onFieldChange}
              placeholder="Paste image link (https://...)"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 font-semibold text-emerald-600 hover:bg-emerald-100">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageFileChange}
                  className="sr-only"
                />
                Upload from computer
              </label>
              <button
                type="button"
                onClick={onImageClear}
                disabled={!imagePreview}
                className="rounded-lg border border-slate-300 px-3 py-1 font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove image
              </button>
              <span className="text-slate-400">or paste a link above</span>
            </div>
            {imagePreview ? (
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img src={imagePreview} alt="Branch preview" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 text-xs text-slate-600">
                  <p className="font-semibold">
                    {form.imageSource === "file"
                      ? imageFileName || "Uploaded image"
                      : "Using image URL"}
                  </p>
                  {form.imageSource === "url" ? (
                    <p className="mt-1 break-all text-slate-500">
                      {form.imageUrl.length > 80 ? `${form.imageUrl.slice(0, 77)}...` : form.imageUrl}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No image selected yet.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPrimary"
              checked={form.isPrimary}
              onChange={onFieldChange}
              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
            />
            Primary branch
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isOpen"
              checked={form.isOpen}
              onChange={onFieldChange}
              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
            />
            Currently operating
          </label>
        </div>
      </div>

      <div>
        <SectionTitle title="Branch address" subtitle="street, ward, district, city fields from restaurant_branches." />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            name="street"
            value={form.street}
            onChange={onFieldChange}
            placeholder="Street"
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            required
          />
          <input
            name="ward"
            value={form.ward}
            onChange={onFieldChange}
            placeholder="Ward"
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
          <input
            name="district"
            value={form.district}
            onChange={onFieldChange}
            placeholder="District"
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
          <input
            name="city"
            value={form.city}
            onChange={onFieldChange}
            placeholder="City"
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldInput
          name="latitude"
          label="Latitude"
          value={form.latitude}
          onChange={onFieldChange}
          placeholder="10.7731"
        />
        <FieldInput
          name="longitude"
          label="Longitude"
          value={form.longitude}
          onChange={onFieldChange}
          placeholder="106.7009"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <SectionTitle title="Opening hours" subtitle="branch_opening_hours records." />
        <div className="mt-3 space-y-3">
          {openingHours.map((item, index) => (
            <div
              key={item.dayOfWeek}
              className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm md:flex-row md:items-center"
            >
              <span className="w-32 text-sm font-medium text-slate-700">{DAY_LABELS[item.dayOfWeek]}</span>
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="time"
                  value={item.openTime}
                  onChange={(event) => onOpeningHourChange(index, "openTime", event.target.value)}
                  disabled={item.isClosed}
                  className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                />
                <span className="text-sm text-slate-500">to</span>
                <input
                  type="time"
                  value={item.closeTime}
                  onChange={(event) => onOpeningHourChange(index, "closeTime", event.target.value)}
                  disabled={item.isClosed}
                  className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={item.isClosed}
                  onChange={(event) => onOpeningHourChange(index, "isClosed", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                />
                Closed
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={item.overnight}
                  onChange={(event) => onOpeningHourChange(index, "overnight", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                />
                Overnight
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <SectionTitle title="Special hours" subtitle="branch_special_hours optional overrides." />
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={specialEnabled}
              onChange={(event) => onSpecialToggle(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
            />
            Enable special hours
          </label>
        </div>

        {specialEnabled ? (
          <>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">Override hours for holidays or events.</p>
              <button
                type="button"
                onClick={onAddSpecialHour}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                + Add special day
              </button>
            </div>
            {specialHours.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No special schedules yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {specialHours.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm md:flex-row md:items-center"
                  >
                    <input
                      type="date"
                      value={item.date}
                      onChange={(event) => onUpdateSpecialHour(index, "date", event.target.value)}
                      className="rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                    />
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="time"
                        value={item.openTime}
                        onChange={(event) => onUpdateSpecialHour(index, "openTime", event.target.value)}
                        disabled={item.isClosed}
                        className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                      />
                      <span className="text-sm text-slate-500">to</span>
                      <input
                        type="time"
                        value={item.closeTime}
                        onChange={(event) => onUpdateSpecialHour(index, "closeTime", event.target.value)}
                        disabled={item.isClosed}
                        className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.isClosed}
                        onChange={(event) => onUpdateSpecialHour(index, "isClosed", event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                      />
                      Closed
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.overnight}
                        onChange={(event) => onUpdateSpecialHour(index, "overnight", event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                      />
                      Overnight
                    </label>
                    <button
                      type="button"
                      onClick={() => onRemoveSpecialHour(index)}
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Turn on special hours for public holidays or custom schedules.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : form.id ? "Save branch" : "Create branch"}
        </button>
      </div>
    </form>
  </section>
);

const SectionTitle = ({ title, subtitle }) => (
  <div className="space-y-1">
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
  </div>
);

const FieldInput = ({ label, as = "input", className = "", ...props }) => {
  const Component = as;
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <Component
        {...props}
        className={`w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${className}`}
      />
    </div>
  );
};

export default RestaurantProfile;













