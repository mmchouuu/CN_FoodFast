import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import restaurantManagerService from "../../services/restaurantManager";

const containerClasses =
  "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto flex-1 w-full lg:w-11/12 bg-primary shadow rounded-xl";

const defaultOpeningHours = () =>
  Array.from({ length: 7 }, (_, index) => ({
    dayOfWeek: index,
    openTime: "08:00",
    closeTime: "22:00",
    isClosed: false,
    overnight: false,
  }));

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const mergeOpeningHoursWithDefaults = (source = []) => {
  const base = defaultOpeningHours();
  const byDay = new Map(source.map((item) => [Number(item.dayOfWeek), item]));
  return base.map((item) => {
    const matched = byDay.get(item.dayOfWeek);
    if (!matched) return { ...item };
    return {
      ...item,
      openTime: matched.openTime || "",
      closeTime: matched.closeTime || "",
      isClosed: Boolean(matched.isClosed),
      overnight: Boolean(matched.overnight),
    };
  });
};

const mapSpecialHoursForForm = (source = []) =>
  source.map((item) => ({
    id: item.id,
    date:
      item.date instanceof Date
        ? item.date.toISOString().split("T")[0]
        : item.date || "",
    openTime: item.openTime || "",
    closeTime: item.closeTime || "",
    isClosed: Boolean(item.isClosed),
    overnight: Boolean(item.overnight),
    note: item.note || "",
  }));

const RestaurantProfile = () => {
  const { user, restaurantProfile } = useAppContext();
  const ownerId = restaurantProfile?.id || user?.id;

  const buildOwnerAccount = useCallback((source) => {
    const base = source || restaurantProfile || {};
    return {
      id: source?.id || base?.id || ownerId || "",
      email: source?.email || base?.email || user?.email || "",
      phone: source?.phone || base?.phone || "",
      managerName:
        source?.managerName ||
        source?.manager_name ||
        base?.managerName ||
        base?.manager_name ||
        "",
      restaurantName:
        source?.restaurantName ||
        source?.restaurant_name ||
        base?.restaurant_name ||
        "",
      companyAddress:
        source?.companyAddress ||
        source?.company_address ||
        base?.company_address ||
        "",
      restaurantStatus:
        source?.restaurantStatus ||
        source?.restaurant_status ||
        base?.restaurant_status ||
        "",
      taxCode: source?.taxCode || source?.tax_code || base?.tax_code || "",
    };
  }, [ownerId, restaurantProfile, user]);

  const formatStatus = (status) => {
    if (!status) return "";
    return status
      .toString()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [branches, setBranches] = useState([]);

  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [ownerAccount, setOwnerAccount] = useState(() => buildOwnerAccount());
  const [viewMode, setViewMode] = useState("loading"); // loading | createRestaurant | summary | editRestaurant | createBranch | editBranch
  const [editingBranch, setEditingBranch] = useState(null);

  const [restaurantForm, setRestaurantForm] = useState(() => ({
    name: ownerAccount.restaurantName || "",
    description: "",
    cuisine: "",
    phone: ownerAccount.phone || "",
    email: ownerAccount.email || "",
  }));

  const [brandImagePreview, setBrandImagePreview] = useState("");
  const [brandImageValue, setBrandImageValue] = useState("");
  const [brandImageLink, setBrandImageLink] = useState("");
  const [brandImageTouched, setBrandImageTouched] = useState(false);
  const brandImageInputRef = useRef(null);
  const [branchImagePreview, setBranchImagePreview] = useState("");
  const [branchImageValue, setBranchImageValue] = useState("");
  const [branchImageLink, setBranchImageLink] = useState("");
  const [branchImageTouched, setBranchImageTouched] = useState(false);
  const branchImageInputRef = useRef(null);

  const [branchForm, setBranchForm] = useState(() => ({
    name: "",
    branchNumber: "",
    brandPhone: ownerAccount.phone || "",
    brandEmail: ownerAccount.email || "",
    street: "",
    ward: "",
    district: "",
    city: "",
    latitude: "",
    longitude: "",
    isPrimary: false,
    isOpen: false,
  }));

  const [openingHours, setOpeningHours] = useState(() => defaultOpeningHours());
  const [specialHours, setSpecialHours] = useState([]);

  const applyRestaurantData = useCallback((data) => {
    if (!data) {
      setRestaurant(null);
      setBranches([]);
      const fallbackOwner = buildOwnerAccount();
      setOwnerAccount(fallbackOwner);
      setRestaurantForm({
        name: fallbackOwner.restaurantName || "",
        description: "",
        cuisine: "",
        phone: fallbackOwner.phone || "",
        email: fallbackOwner.email || "",
      });
      setBrandImagePreview("");
      setBrandImageValue("");
      setBrandImageLink("");
      setBrandImageTouched(false);
      setBranchForm({
        name: "",
        branchNumber: "",
        brandPhone: fallbackOwner.phone || "",
        brandEmail: fallbackOwner.email || "",
        street: "",
        ward: "",
        district: "",
        city: "",
        latitude: "",
        longitude: "",
        isPrimary: true,
        isOpen: false,
      });
      setBranchImagePreview("");
      setBranchImageValue("");
      setBranchImageLink("");
      setBranchImageTouched(false);
      setOpeningHours(defaultOpeningHours());
      setSpecialHours([]);
      setEditingBranch(null);
      setViewMode("createRestaurant");
      return;
    }

    setRestaurant(data);
    const branchList = Array.isArray(data.branches) ? data.branches : [];
    setBranches(branchList);
    const owner = buildOwnerAccount(data.owner);
    setOwnerAccount(owner);

    if (!data.id && data.pending_profile) {
      setViewMode("createRestaurant");
      setRestaurantForm({
        name: data.name || owner.restaurantName || "",
        description: "",
        cuisine: "",
        phone: data.phone || owner.phone || "",
        email: data.email || owner.email || "",
      });
    } else if (data.id) {
      setViewMode("summary");
      setRestaurantForm({
        name: data.name || owner.restaurantName || "",
        description: data.description ?? "",
        cuisine: data.cuisine ?? "",
        phone: data.phone || owner.phone || "",
        email: data.email || owner.email || "",
      });
    } else {
      setViewMode("createRestaurant");
    }

    const firstImage =
      Array.isArray(data.images) && data.images.length ? data.images[0] : "";
    setBrandImagePreview(firstImage);
    setBrandImageValue(firstImage);
    setBrandImageLink("");
    setBrandImageTouched(false);

    setBranchForm((prev) => ({
      ...prev,
      brandPhone: data.phone || owner.phone || "",
      brandEmail: data.email || owner.email || "",
      isPrimary: branchList.length === 0,
    }));
    setBranchImagePreview("");
    setBranchImageValue("");
    setBranchImageLink("");
    setBranchImageTouched(false);
    setOpeningHours(defaultOpeningHours());
    setSpecialHours([]);
    setEditingBranch(null);
  }, [buildOwnerAccount]);


  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await restaurantManagerService.getByOwner(ownerId);
        applyRestaurantData(data);
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || "Unable to load restaurant information.");
        applyRestaurantData(null);
        setViewMode("createRestaurant");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ownerId, applyRestaurantData]);

  useEffect(() => {
    if (restaurant?.id) {
      return;
    }
    setOwnerAccount(buildOwnerAccount());
  }, [restaurantProfile, restaurant?.id, buildOwnerAccount]);

  useEffect(() => {
    if (!ownerAccount) {
      return;
    }
    if (!restaurant?.id) {
      setRestaurantForm((prev) => ({
        ...prev,
        name: ownerAccount.restaurantName || prev.name,
        email: ownerAccount.email || prev.email,
        phone: ownerAccount.phone || prev.phone,
      }));
    }
    setBranchForm((prev) => ({
      ...prev,
      brandPhone: prev.brandPhone || ownerAccount.phone || "",
      brandEmail: prev.brandEmail || ownerAccount.email || "",
    }));
  }, [ownerAccount, restaurant?.id]);

  useEffect(() => {
    if (branches.length === 0) {
      setBranchForm((prev) => ({ ...prev, isPrimary: true }));
    }
  }, [branches.length]);

  const handleRestaurantFormChange = (event) => {
    const { name, value } = event.target;
    setRestaurantForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectBrandFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString() || "";
      setBrandImageValue(result);
      setBrandImagePreview(result);
      setBrandImageLink("");
      setBrandImageTouched(true);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyBrandImageLink = () => {
    const trimmed = brandImageLink.trim();
    if (!trimmed) {
      toast.error("Please enter an image URL first.");
      return;
    }
    setBrandImageValue(trimmed);
    setBrandImagePreview(trimmed);
    toast.success("Image link applied.");
    setBrandImageTouched(true);
  };

  const clearBrandImage = () => {
    setBrandImagePreview("");
    setBrandImageValue("");
    setBrandImageLink("");
    setBrandImageTouched(true);
    if (brandImageInputRef.current) {
      brandImageInputRef.current.value = "";
    }
  };

  const handleSelectBranchImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString() || "";
      setBranchImageValue(result);
      setBranchImagePreview(result);
      setBranchImageLink("");
      setBranchImageTouched(true);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyBranchImageLink = () => {
    const trimmed = branchImageLink.trim();
    if (!trimmed) {
      toast.error("Please enter a branch image URL first.");
      return;
    }
    setBranchImageValue(trimmed);
    setBranchImagePreview(trimmed);
    toast.success("Branch image applied.");
    setBranchImageTouched(true);
  };

  const clearBranchImage = () => {
    setBranchImagePreview("");
    setBranchImageValue("");
    setBranchImageLink("");
    setBranchImageTouched(true);
    if (branchImageInputRef.current) {
      branchImageInputRef.current.value = "";
    }
  };

  const handleBranchFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setBranchForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const resetBranchForm = (options = {}) => {
    const {
      isPrimary = branches.length === 0,
      branchNumber = "",
      persistContact = true,
    } = options;
    setBranchForm({
      name: "",
      branchNumber: branchNumber ? String(branchNumber) : "",
      brandPhone: persistContact
        ? restaurantForm.phone || ownerAccount.phone || ""
        : "",
      brandEmail: persistContact
        ? restaurantForm.email || ownerAccount.email || ""
        : "",
      street: "",
      ward: "",
      district: "",
      city: "",
      latitude: "",
      longitude: "",
      isPrimary,
      isOpen: false,
    });
    setBranchImagePreview("");
    setBranchImageValue("");
    setBranchImageLink("");
    setBranchImageTouched(false);
    setOpeningHours(() => defaultOpeningHours());
    setSpecialHours([]);
    setEditingBranch(null);
  };

  const startBranchCreation = (options = {}) => {
    resetBranchForm(options);
    setViewMode("createBranch");
  };

  const startBranchEdit = (branch) => {
    if (!branch) return;
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name || "",
      branchNumber: branch.branchNumber ? String(branch.branchNumber) : "",
      brandPhone: branch.brandPhone || "",
      brandEmail: branch.brandEmail || "",
      street: branch.street || "",
      ward: branch.ward || "",
      district: branch.district || "",
      city: branch.city || "",
      latitude: branch.latitude != null ? String(branch.latitude) : "",
      longitude: branch.longitude != null ? String(branch.longitude) : "",
      isPrimary: Boolean(branch.isPrimary),
      isOpen: Boolean(branch.isOpen),
    });
    const firstImage =
      Array.isArray(branch.images) && branch.images.length
        ? branch.images[0]
        : "";
    setBranchImagePreview(firstImage);
    setBranchImageValue(firstImage);
    setBranchImageLink("");
    setBranchImageTouched(false);
    setOpeningHours(mergeOpeningHoursWithDefaults(branch.openingHours || []));
    setSpecialHours(mapSpecialHoursForForm(branch.specialHours || []));
    setViewMode("editBranch");
  };

  const cancelBranchEdit = () => {
    resetBranchForm();
    setViewMode(restaurant?.id ? "summary" : "createRestaurant");
  };

  const handleAutoFillCoordinates = async () => {
    const addressParts = [
      branchForm.street,
      branchForm.ward,
      branchForm.district,
      branchForm.city,
    ]
      .map((part) => part?.trim())
      .filter(Boolean);

    if (!addressParts.length) {
      toast.error("Please provide the branch address before auto-filling coordinates.");
      return;
    }

    setGeocoding(true);
    try {
      const params = new URLSearchParams({
        format: "json",
        addressdetails: "1",
        limit: "1",
        q: addressParts.join(", "),
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          "Accept-Language": "vi,en",
        },
      });
      if (!response.ok) {
        throw new Error("Unable to contact the geocoding service.");
      }
      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        toast.error("Could not determine coordinates for this address.");
        return;
      }
      const { lat, lon } = results[0];
      if (!lat || !lon) {
        toast.error("Geocoding service did not return coordinates.");
        return;
      }
      const latitude = Number.parseFloat(lat).toFixed(6);
      const longitude = Number.parseFloat(lon).toFixed(6);
      setBranchForm((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));
      toast.success("Coordinates filled based on the address.");
    } catch (err) {
      toast.error(err?.message || "Unable to auto-fill coordinates right now.");
    } finally {
      setGeocoding(false);
    }
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

  const addSpecialHourRow = () => {
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

  const refreshRestaurant = async () => {
    if (!ownerId) return;
    try {
      const data = await restaurantManagerService.getByOwner(ownerId);
      applyRestaurantData(data);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Unable to refresh restaurant data.");
    }
  };

  const handleCreateRestaurant = async (event) => {
    event.preventDefault();
    if (!ownerId) {
      toast.error("Please sign in with a restaurant account first.");
      return;
    }
    setCreatingRestaurant(true);
    try {
      const basePayload = {
        name: restaurantForm.name.trim(),
        description: restaurantForm.description.trim() || null,
        cuisine: restaurantForm.cuisine.trim() || null,
        phone: restaurantForm.phone.trim() || null,
        email: restaurantForm.email.trim() || null,
      };

      if (!basePayload.name) {
        toast.error("Restaurant name is required.");
        return;
      }

      const isEditingRestaurant = viewMode === "editRestaurant" && restaurant?.id;

      if (isEditingRestaurant) {
        const updatePayload = { ...basePayload };
        if (brandImageTouched) {
          updatePayload.images = brandImageValue ? [brandImageValue] : [];
        }
        await restaurantManagerService.updateRestaurant(restaurant.id, updatePayload);
        toast.success("Restaurant information updated.");
      } else {
        const createPayload = {
          ownerId,
          ...basePayload,
          images: brandImageValue ? [brandImageValue] : undefined,
        };
        await restaurantManagerService.createRestaurant(createPayload);
        toast.success("Restaurant created successfully.");
      }

      setBrandImageTouched(false);
      await refreshRestaurant();

      if (isEditingRestaurant) {
        setViewMode("summary");
      } else {
        startBranchCreation({ isPrimary: true });
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Unable to create restaurant.");
    } finally {
      setCreatingRestaurant(false);
    }
  };

  const startRestaurantEdit = () => {
    if (!restaurant?.id) {
      setViewMode("createRestaurant");
      return;
    }
    setViewMode("editRestaurant");
    setRestaurantForm({
      name: restaurant.name || "",
      description: restaurant.description || "",
      cuisine: restaurant.cuisine || "",
      phone: restaurant.phone || ownerAccount.phone || "",
      email: restaurant.email || ownerAccount.email || "",
    });
    const firstImage =
      Array.isArray(restaurant.images) && restaurant.images.length
        ? restaurant.images[0]
        : "";
    setBrandImagePreview(firstImage);
    setBrandImageValue(firstImage);
    setBrandImageLink("");
    setBrandImageTouched(false);
  };

  const cancelRestaurantEdit = () => {
    if (restaurant?.id) {
      const firstImage =
        Array.isArray(restaurant.images) && restaurant.images.length
          ? restaurant.images[0]
          : "";
      setRestaurantForm({
        name: restaurant.name || "",
        description: restaurant.description || "",
        cuisine: restaurant.cuisine || "",
        phone: restaurant.phone || ownerAccount.phone || "",
        email: restaurant.email || ownerAccount.email || "",
      });
      setBrandImagePreview(firstImage);
      setBrandImageValue(firstImage);
      setBrandImageLink("");
      setViewMode("summary");
    } else {
      const owner = buildOwnerAccount();
      setRestaurantForm({
        name: owner.restaurantName || "",
        description: "",
        cuisine: "",
        phone: owner.phone || "",
        email: owner.email || "",
      });
      setBrandImagePreview("");
      setBrandImageValue("");
      setBrandImageLink("");
      setViewMode("createRestaurant");
    }
    setBrandImageTouched(false);
  };

  const handleCreateBranch = async (event) => {
    event.preventDefault();
    if (!restaurant?.id) {
      toast.error("Create a restaurant before adding branches.");
      return;
    }
    setCreatingBranch(true);
    try {
      const payload = {
        name: branchForm.name.trim(),
        branchNumber: branchForm.branchNumber ? Number(branchForm.branchNumber) : undefined,
        brandPhone: branchForm.brandPhone.trim() || null,
        brandEmail: branchForm.brandEmail.trim() || null,
        street: branchForm.street.trim() || null,
        ward: branchForm.ward.trim() || null,
        district: branchForm.district.trim() || null,
        city: branchForm.city.trim() || null,
        latitude: branchForm.latitude ? parseFloat(branchForm.latitude) : null,
        longitude: branchForm.longitude ? parseFloat(branchForm.longitude) : null,
        isPrimary: branchForm.isPrimary,
        isOpen: branchForm.isOpen,
        images:
          editingBranch
            ? branchImageTouched
              ? branchImageValue
                ? [branchImageValue]
                : []
              : undefined
            : branchImageValue
            ? [branchImageValue]
            : undefined,
        openingHours: openingHours.map((item) => ({
          dayOfWeek: item.dayOfWeek,
          openTime: item.isClosed ? null : item.openTime,
          closeTime: item.isClosed ? null : item.closeTime,
          isClosed: item.isClosed,
          overnight: item.overnight,
        })),
        specialHours: specialHours.map((item) => ({
          date: item.date,
          openTime: item.isClosed ? null : item.openTime,
          closeTime: item.isClosed ? null : item.closeTime,
          isClosed: item.isClosed,
          overnight: item.overnight,
          note: item.note,
        })),
      };

      if (editingBranch) {
        await restaurantManagerService.updateBranch(restaurant.id, editingBranch.id, payload);
        toast.success("Branch updated successfully.");
      } else {
        await restaurantManagerService.createBranch(restaurant.id, payload);
        toast.success("Branch created successfully.");
      }

      resetBranchForm();
      await refreshRestaurant();
      setViewMode("summary");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Unable to create branch.");
    } finally {
      setCreatingBranch(false);
    }
  };

  const renderLoading = () => <p className="text-sm text-gray-600">Loading restaurant information...</p>;

  const renderRestaurantInfo = () => {
    const statusLabel =
      formatStatus(ownerAccount.restaurantStatus || restaurant?.restaurant_status) || null;
    const averageRating =
      restaurant?.avg_branch_rating != null
        ? Number(restaurant.avg_branch_rating).toFixed(2)
        : null;
    const ratedBranches =
      typeof restaurant?.total_branch_ratings === "number"
        ? restaurant.total_branch_ratings
        : null;

    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
        <header className="space-y-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {restaurant?.name || ownerAccount.restaurantName || "Restaurant profile"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusLabel ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {statusLabel}
                </span>
              ) : null}
              <button
                type="button"
                onClick={startRestaurantEdit}
                disabled={viewMode === "editRestaurant"}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Edit restaurant
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {restaurant?.description?.trim() ||
              "No description provided yet. Add a short introduction for your brand."}
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Owner contact
            </h3>
            <InfoRow label="Manager" value={ownerAccount.managerName} />
            <InfoRow label="Email" value={ownerAccount.email} />
            <InfoRow label="Phone" value={ownerAccount.phone} />
            <InfoRow label="Company address" value={ownerAccount.companyAddress} />
            <InfoRow label="Tax code" value={ownerAccount.taxCode} />
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Brand profile
            </h3>
            <InfoRow
              label="Hotline"
              value={restaurant?.phone || ownerAccount.phone}
              fallback="Not available"
            />
            <InfoRow
              label="Contact email"
              value={restaurant?.email || ownerAccount.email}
              fallback="Not available"
            />
            <InfoRow label="Cuisine" value={restaurant?.cuisine} fallback="Not specified" />
            <InfoRow
              label="Operating status"
              value={restaurant?.is_active ? "Active" : "Inactive"}
              fallback="Inactive"
            />
            <InfoRow label="Rated branches" value={ratedBranches} fallback="0" />
            <InfoRow label="Average branch rating" value={averageRating} fallback="0.00" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Brand image
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {Array.isArray(restaurant?.images) && restaurant.images.length ? (
              restaurant.images.map((img, index) => (
                <div
                  key={img || index}
                  className="h-32 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <img src={img} alt={`Brand ${index + 1}`} className="h-full w-full object-cover" />
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500">No brand image uploaded.</span>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderBranches = () => {
    const branchFormOpen = viewMode === "createBranch" || viewMode === "editBranch";

    return (
      <section className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Branches</h2>
          <span className="text-sm text-slate-500">
            {branches.length ? `${branches.length} branch(es)` : "No branches yet"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => startBranchCreation({ isPrimary: branches.length === 0 })}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
          >
            Add branch
          </button>
          <button
            type="button"
            onClick={() =>
              branchFormOpen
                ? cancelBranchEdit()
                : startBranchCreation({ isPrimary: branches.length === 0 })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            {branchFormOpen ? (editingBranch ? "Cancel edit" : "Hide form") : "Show form"}
          </button>
        </div>
      </header>
      {branches.length ? (
        <div className="space-y-4">
          {branches.map((branch) => {
            const branchImages = Array.isArray(branch.images)
              ? branch.images.filter(Boolean)
              : branch.images
              ? [branch.images].filter(Boolean)
              : [];
              return (
                <div key={branch.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {branch.name || `Branch #${branch.branchNumber}`}
                    </h3>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {branch.isPrimary ? "Primary branch" : `Branch ${branch.branchNumber}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        branch.isOpen
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {branch.isOpen ? "Open for service" : "Not open yet"}
                    </span>
                    <button
                      type="button"
                      onClick={() => startBranchEdit(branch)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoCard
                    label="Address"
                    value={
                    [branch.street, branch.ward, branch.district, branch.city]
                      .filter(Boolean)
                      .join(", ") || "Not specified"
                  }
                />
                <InfoCard label="Phone" value={branch.brandPhone || "Not provided"} />
                <InfoCard label="Email" value={branch.brandEmail || "Not provided"} />
                <InfoCard
                  label="Coordinates"
                  value={
                    branch.latitude && branch.longitude
                      ? `${branch.latitude}, ${branch.longitude}`
                      : "Not set"
                  }
                />
                <InfoCard
                  label="Rating"
                  value={
                    branch.rating != null
                      ? Number(branch.rating).toFixed(1)
                      : "Not rated"
                  }
                />
              </div>
              {branchImages.length ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch images</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {branchImages.map((img, index) => (
                      <div
                        key={img || index}
                        className="h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={img}
                          alt={`Branch ${branch.branchNumber} image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opening hours</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {branch.openingHours?.length ? (
                    branch.openingHours.map((hour) => {
                      const weekday = Number(hour.dayOfWeek);
                      const label = DAY_LABELS[weekday] || `Day ${weekday}`;
                      return (
                        <li key={hour.id}>
                          {label}:{" "}
                          {hour.isClosed
                            ? "Closed"
                            : `${hour.openTime || "--:--"} - ${hour.closeTime || "--:--"}`}{" "}
                          {hour.overnight ? "(Overnight)" : ""}
                        </li>
                      );
                    })
                  ) : (
                    <li>Not configured.</li>
                  )}
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Special days
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {branch.specialHours?.length ? (
                    branch.specialHours.map((item) => {
                      const formattedDate =
                        item.date instanceof Date
                          ? item.date.toISOString().split("T")[0]
                          : item.date;
                      return (
                        <li key={item.id}>
                          {formattedDate}:{" "}
                          {item.isClosed
                            ? "Closed"
                            : `${item.openTime || "--:--"} - ${item.closeTime || "--:--"}`}{" "}
                          {item.overnight ? "(Overnight)" : ""}
                          {item.note ? ` – ${item.note}` : ""}
                        </li>
                      );
                    })
                  ) : (
                    <li>No special schedule configured.</li>
                  )}
                </ul>
              </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-600">No branches created yet. Use the form below to add one.</p>
      )}
      </section>
    );
  };

  const renderRestaurantForm = () => (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {viewMode === "editRestaurant" ? "Update restaurant" : "Create a restaurant"}
          </h2>
          <p className="text-sm text-slate-600">
            Enter the base information for your brand. You can add branches afterwards.
          </p>
        </div>
        {viewMode === "editRestaurant" && (
          <button
            type="button"
            onClick={cancelRestaurantEdit}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
      </header>
      <form onSubmit={handleCreateRestaurant} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Restaurant name
          </label>
          <input
            name="name"
            value={restaurantForm.name}
            onChange={handleRestaurantFormChange}
            required
            className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput
            label="Email"
            name="email"
            value={restaurantForm.email}
            onChange={handleRestaurantFormChange}
            type="email"
          />
          <FieldInput
            label="Hotline"
            name="phone"
            value={restaurantForm.phone}
            onChange={handleRestaurantFormChange}
            type="tel"
          />
        </div>
        <FieldInput
          label="Description"
          name="description"
          value={restaurantForm.description}
          onChange={handleRestaurantFormChange}
          as="textarea"
          rows={3}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput
            label="Cuisine"
            name="cuisine"
            value={restaurantForm.cuisine}
            onChange={handleRestaurantFormChange}
          />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand image</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {brandImagePreview ? (
                <img src={brandImagePreview} alt="Brand preview" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-xs text-slate-500">
                  No image selected
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => brandImageInputRef.current?.click()}
                  className="rounded-lg border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                >
                  Upload from device
                </button>
                <input
                  ref={brandImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelectBrandFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={clearBrandImage}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  Clear image
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wide text-slate-500">
                  Or paste image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/brand-image.jpg"
                    value={brandImageLink}
                    onChange={(event) => setBrandImageLink(event.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBrandImageLink}
                    className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creatingRestaurant}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {creatingRestaurant
              ? viewMode === "editRestaurant"
                ? "Saving..."
                : "Creating..."
              : viewMode === "editRestaurant"
              ? "Save changes"
              : "Create restaurant"}
          </button>
        </div>
      </form>
    </section>
  );

  const renderCreateBranchForm = () => (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {editingBranch ? "Update branch" : "Add a branch"}
          </h2>
          <p className="text-sm text-slate-600">
            Provide full branch details. The first branch will automatically be marked as primary.
          </p>
        </div>
        <button
          type="button"
          onClick={cancelBranchEdit}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          {editingBranch ? "Cancel edit" : "Close form"}
        </button>
      </header>
      <form onSubmit={handleCreateBranch} className="space-y-4">
        <FieldInput
          label="Branch name"
          name="name"
          value={branchForm.name}
          onChange={handleBranchFormChange}
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput
            label="Branch phone"
            name="brandPhone"
            value={branchForm.brandPhone}
            onChange={handleBranchFormChange}
          />
          <FieldInput
            label="Branch email"
            name="brandEmail"
            value={branchForm.brandEmail}
            onChange={handleBranchFormChange}
            type="email"
          />
        </div>
        <FieldInput
          label="Branch number (optional)"
          name="branchNumber"
          value={branchForm.branchNumber}
          onChange={handleBranchFormChange}
          type="number"
          min="1"
          placeholder={String((branches.length || 0) + 1)}
        />
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Address
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="street"
              placeholder="Street and number"
              value={branchForm.street}
              onChange={handleBranchFormChange}
              required
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
            <input
              name="ward"
              placeholder="Ward"
              value={branchForm.ward}
              onChange={handleBranchFormChange}
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
            <input
              name="district"
              placeholder="District"
              value={branchForm.district}
              onChange={handleBranchFormChange}
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
            <input
              name="city"
              placeholder="City"
              value={branchForm.city}
              onChange={handleBranchFormChange}
              required
              className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-slate-500">
              Provide a precise address so we can locate this branch on the map.
            </p>
            <button
              type="button"
              onClick={handleAutoFillCoordinates}
              disabled={geocoding}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60"
            >
              {geocoding ? "Locating..." : "Auto-fill coordinates"}
            </button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput
            label="Latitude"
            name="latitude"
            value={branchForm.latitude}
            onChange={handleBranchFormChange}
            placeholder="E.g. 10.7731"
          />
          <FieldInput
            label="Longitude"
            name="longitude"
            value={branchForm.longitude}
            onChange={handleBranchFormChange}
            placeholder="E.g. 106.7009"
          />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch image</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {branchImagePreview ? (
                <img src={branchImagePreview} alt="Branch preview" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-xs text-slate-500">No image selected</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => branchImageInputRef.current?.click()}
                  className="rounded-lg border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                >
                  Upload from device
                </button>
                <input
                  ref={branchImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelectBranchImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={clearBranchImage}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  Clear image
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wide text-slate-500">
                  Or paste image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/branch-image.jpg"
                    value={branchImageLink}
                    onChange={(event) => setBranchImageLink(event.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBranchImageLink}
                    className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="isPrimary"
              checked={branchForm.isPrimary}
              onChange={handleBranchFormChange}
              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
            />
            Mark as primary branch
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="isOpen"
              checked={branchForm.isOpen}
              onChange={handleBranchFormChange}
              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
            />
            Branch already operating
          </label>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Opening hours</p>
          <div className="mt-3 space-y-2">
            {openingHours.map((item, index) => (
              <div
                key={item.dayOfWeek}
                className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm md:flex-row md:items-center"
              >
                <span className="w-28 text-sm font-medium text-slate-700">
                  {DAY_LABELS[item.dayOfWeek]}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={item.openTime}
                    onChange={(event) => handleOpeningHourChange(index, "openTime", event.target.value)}
                    disabled={item.isClosed}
                    className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                  />
                  <span className="text-sm text-slate-500">to</span>
                  <input
                    type="time"
                    value={item.closeTime}
                    onChange={(event) => handleOpeningHourChange(index, "closeTime", event.target.value)}
                    disabled={item.isClosed}
                    className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={item.isClosed}
                    onChange={(event) => handleOpeningHourChange(index, "isClosed", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  Closed
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={item.overnight}
                    onChange={(event) => handleOpeningHourChange(index, "overnight", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  Overnight
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Special days</p>
            <button
              type="button"
              onClick={addSpecialHourRow}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              + Add special day
            </button>
          </div>
          {specialHours.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No special day configured.</p>
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
                    onChange={(event) => updateSpecialHour(index, "date", event.target.value)}
                    className="rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="time"
                      value={item.openTime}
                      onChange={(event) => updateSpecialHour(index, "openTime", event.target.value)}
                      disabled={item.isClosed}
                      className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                    />
                    <span className="text-sm text-slate-500">to</span>
                    <input
                      type="time"
                      value={item.closeTime}
                      onChange={(event) => updateSpecialHour(index, "closeTime", event.target.value)}
                      disabled={item.isClosed}
                      className="w-28 rounded-lg border border-slate-200 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:bg-slate-100"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={item.isClosed}
                      onChange={(event) => updateSpecialHour(index, "isClosed", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    Closed
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={item.overnight}
                      onChange={(event) => updateSpecialHour(index, "overnight", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    Overnight
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSpecialHour(index)}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creatingBranch}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {creatingBranch
              ? editingBranch
                ? "Saving..."
                : "Creating..."
              : editingBranch
              ? "Save branch"
              : "Create branch"}
          </button>
        </div>
      </form>
    </section>
  );

  if (!ownerId) {
    return (
      <div className={containerClasses}>
        <p className="text-sm text-red-500">Please sign in with a restaurant account to manage information.</p>
      </div>
    );
  }

  const hasRestaurantRecord = Boolean(restaurant?.id);
  const showRestaurantFormSection =
    viewMode === "createRestaurant" || viewMode === "editRestaurant";
  const showBranchFormSection =
    hasRestaurantRecord && (viewMode === "createBranch" || viewMode === "editBranch");

  return (
    <div className={containerClasses}>
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Restaurant Management</h1>
          <p className="text-sm text-slate-600">Update your brand profile and manage branches.</p>
        </div>
        <button
          type="button"
          onClick={refreshRestaurant}
          className="rounded-lg border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
        >
          Refresh
        </button>
      </header>
      {error ? <p className="mb-4 text-sm text-red-500">{error}</p> : null}
      {loading ? (
        renderLoading()
      ) : (
        <div className="space-y-6">
          {showRestaurantFormSection ? renderRestaurantForm() : renderRestaurantInfo()}
          {hasRestaurantRecord ? renderBranches() : null}
          {showBranchFormSection ? renderCreateBranchForm() : null}
        </div>
      )}
    </div>
  );
};

const FieldInput = ({ label, as = "input", ...props }) => {
  const Component = as;
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <Component
        {...props}
        className={`w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${props.className || ""}`}
      />
    </div>
  );
};

const InfoRow = ({ label, value, fallback = "Not provided" }) => {
  const display =
    value === null || value === undefined || value === ""
      ? fallback
      : value;
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-700">{display}</span>
    </div>
  );
};

const InfoCard = ({ label, value, fallback = "Not provided" }) => {
  const display =
    value === null || value === undefined || value === ""
      ? fallback
      : value;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{display}</p>
    </div>
  );
};

export default RestaurantProfile;
