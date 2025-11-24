import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import RatingStars from "../components/RatingStars";
import { useAppContext } from "../context/AppContext";
import {
  dishPlaceholderImage,
  pickFirstImageUrl,
  restaurantPlaceholderImage,
} from "../utils/imageHelpers";
import { resolveBranchDishes } from "../utils/branchProducts";


const getBasePrice = (dish) => {
  if (!dish || !dish.price) return 0;
  const prices =
    dish.sizes?.length && dish.sizes.every((size) => dish.price?.[size])
      ? dish.sizes.map((size) => dish.price[size])
      : Object.values(dish.price);
  const numericPrices = prices.filter((value) => typeof value === "number");
  if (!numericPrices.length) return 0;
  const lowest = Math.min(...numericPrices);
  const taxRate = dish.taxRate ?? 0;
  if (taxRate > 0) {
    return Math.round(lowest * (1 + taxRate));
  }
  if (dish.priceWithTax && dish.priceWithTax > lowest) {
    return Math.round(dish.priceWithTax);
  }
  return lowest;
};

const sortOptions = [
  { id: "default", label: "Default" },
  { id: "new", label: "New arrivals" },
  { id: "best", label: "Most popular" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
];

const DishCard = ({ dish, restaurantId, currency, onAdd, isDisabled = false }) => {
  const defaultSize = dish.sizes?.[0];
  const basePrice = getBasePrice(dish);
  const dishImage = pickFirstImageUrl(
    dishPlaceholderImage,
    dish.images,
    dish.image,
    dish.heroImage,
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        to={`/restaurants/${restaurantId}/dishes/${dish._id}`}
        className="relative aspect-[4/3] overflow-hidden bg-orange-50"
      >
        <img
          src={dishImage}
          alt={dish.title}
          className="h-full w-full object-cover object-center transition duration-300 hover:scale-105"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = dishPlaceholderImage; }}
        />
        {dish.tags?.[0] ? (
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-500 shadow">
            {dish.tags[0]}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {dish.title}
            </h3>
            <p className="text-xs uppercase text-gray-400">{dish.category}</p>
          </div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-500">
            {Number.isFinite(dish.rating) ? dish.rating.toFixed(1) : "—"} stars
          </span>
        </div>
        <p className="text-sm text-gray-500 line-clamp-3">{dish.description}</p>
        <div className="mt-auto flex items-center justify-between">
          <p className="text-lg font-semibold text-gray-900">
            {currency}
            {basePrice ? basePrice.toLocaleString() : "0"}
            <span className="ml-1 text-xs font-normal text-gray-500">
              incl. VAT
            </span>
          </p>
          <button
            onClick={() => onAdd(dish._id, defaultSize || dish.sizes?.[0])}
            disabled={isDisabled}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              isDisabled
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {isDisabled ? 'Closed' : 'Add to cart'}
          </button>
        </div>
        <Link
          to={`/restaurants/${restaurantId}/dishes/${dish._id}`}
          className="text-sm font-semibold text-orange-500 hover:underline"
        >
          View dish details
        </Link>
      </div>
    </div>
  );
};

const formatBranchAddress = (branch) =>
  branch
    ? [
        branch.street,
        branch.ward,
        branch.district,
        branch.city,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

const RestaurantDetail = () => {
  const { restaurantId: branchId } = useParams();
  const {
    getRestaurantById,
    getDishesByRestaurant,
    getReviewsForRestaurant,
    getRestaurantRatingSummary,
    loadRestaurantReviews,
    addToCart,
    currency,
  } = useAppContext();

  const restaurant = getRestaurantById(branchId);

  const dishes = useMemo(() =>
    resolveBranchDishes({
      branch: restaurant,
      getDishesByRestaurant,
      fallbackRestaurantId: branchId,
    }),
  [restaurant, branchId, getDishesByRestaurant]);

  const branchCategoryFilters = useMemo(() => {
    if (!restaurant) return [];
    const assignments = Array.isArray(restaurant.categoryAssignments)
      ? restaurant.categoryAssignments
      : [];
    if (assignments.length) {
      return assignments
        .map((assignment) => {
          if (!assignment) return null;
          const name =
            assignment.name ||
            assignment.category_name ||
            assignment.category ||
            assignment.label ||
            null;
          const id =
            assignment.category_id ||
            assignment.id ||
            assignment.categoryId ||
            name;
          if (!id || !name) return null;
          return {
            id,
            name,
            isActive: assignment.is_active !== false,
            isVisible: assignment.is_visible !== false,
          };
        })
        .filter(Boolean);
    }
    const fallbackNames = Array.isArray(restaurant.categories)
      ? restaurant.categories.filter(Boolean)
      : [];
    return fallbackNames.map((name) => ({
      id: name,
      name,
      isActive: true,
      isVisible: true,
    }));
  }, [restaurant]);

  const [activeCategory, setActiveCategory] = useState("all");
  const [dishSearch, setDishSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState(300000);
  const [minRating, setMinRating] = useState(0);
  const [sortOption, setSortOption] = useState("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCategoryOpen, setIsCategoryOpen] = useState(true);
  const pageSize = 6;

  const categories = useMemo(() => {
    const assignedNames = branchCategoryFilters
      .filter((category) => category.isActive && category.isVisible)
      .map((category) => category.name);
    if (assignedNames.length) {
      return ["all", ...Array.from(new Set(assignedNames))];
    }
    const set = new Set(["all"]);
    dishes.forEach((dish) => {
      if (dish?.category) {
        set.add(dish.category);
      }
    });
    return Array.from(set);
  }, [branchCategoryFilters, dishes]);

  const ratingTargetId =
    restaurant?.brandRestaurantId ||
    restaurant?.restaurantId ||
    restaurant?.id ||
    branchId;
  const reviewsForRestaurant = useMemo(
    () => getReviewsForRestaurant(ratingTargetId),
    [getReviewsForRestaurant, ratingTargetId]
  );
  const ratingSummary = useMemo(
    () => getRestaurantRatingSummary(ratingTargetId),
    [getRestaurantRatingSummary, ratingTargetId]
  );

  useEffect(() => {
    setActiveCategory("all");
  }, [restaurant?.id]);

  useEffect(() => {
    if (!ratingTargetId) return;
    loadRestaurantReviews(ratingTargetId).catch(() => {});
  }, [ratingTargetId, loadRestaurantReviews]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, dishSearch, maxPrice, minRating, sortOption]);

  const heroImage = pickFirstImageUrl(
    restaurantPlaceholderImage,
    restaurant?.heroImage,
    restaurant?.coverImage,
    restaurant?.images,
  );
  const branchAddressLine =
    formatBranchAddress(restaurant) || restaurant?.address || "";
  const contactPhone =
    restaurant?.branch_phone ||
    restaurant?.branchPhone ||
    restaurant?.phone ||
    restaurant?.brand?.phone ||
    "";
  const contactEmail =
    restaurant?.branch_email ||
    restaurant?.branchEmail ||
    restaurant?.email ||
    restaurant?.brand?.email ||
    "";
  const branchOpenState = restaurant?.is_open ?? restaurant?.isOpen;
  const isBranchOpen = typeof branchOpenState === "boolean" ? branchOpenState : null;
  const hoursLabel =
    isBranchOpen !== null
      ? isBranchOpen
        ? "Open now"
        : "Closed at the moment"
      : restaurant?.shortHours || restaurant?.brand?.shortHours || "Open daily";
  const todaysBranchHours =
    Array.isArray(restaurant?.openingHours) && restaurant.openingHours.length
      ? restaurant.openingHours[0]
      : null;

  const filteredDishes = useMemo(() => {
    return dishes
      .filter((dish) => {
        const matchesCategory =
          activeCategory === "all" || dish.category === activeCategory;
        const matchesSearch =
          !dishSearch ||
          dish.title.toLowerCase().includes(dishSearch.toLowerCase()) ||
          dish.tags?.some((tag) =>
            tag.toLowerCase().includes(dishSearch.toLowerCase())
          );
        const price = getBasePrice(dish);
        const rating = dish.rating ?? 4.5;
        const matchesPrice = price <= maxPrice;
        const matchesRating = rating >= minRating;
        return matchesCategory && matchesSearch && matchesPrice && matchesRating;
      })
      .sort((a, b) => {
        const priceA = getBasePrice(a);
        const priceB = getBasePrice(b);
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        const reviewsA = a.reviewCount ?? 0;
        const reviewsB = b.reviewCount ?? 0;
        switch (sortOption) {
          case "new":
            return (b.createdAt || 0) - (a.createdAt || 0);
          case "best":
            return reviewsB - reviewsA;
          case "price-low":
            return priceA - priceB;
          case "price-high":
            return priceB - priceA;
          default:
            return ratingB - ratingA;
        }
      });
  }, [dishes, activeCategory, dishSearch, maxPrice, minRating, sortOption]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDishes.length / pageSize)),
    [filteredDishes.length, pageSize]
  );

  const paginatedDishes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDishes.slice(start, start + pageSize);
  }, [filteredDishes, currentPage, pageSize]);

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );

  useEffect(() => {
    setCurrentPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [totalPages]);

  if (!restaurant) {
    return (
      <div className="max-padd-container py-36 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Restaurant not found
        </h1>
        <p className="mt-2 text-gray-500">
          The restaurant may be temporarily unavailable or has been removed.
        </p>
        <Link
          to="/restaurants"
          className="mt-6 inline-block rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white"
        >
          Browse other restaurants
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-14 pb-24">
      <section className="relative h-[360px] w-full overflow-hidden rounded-b-[48px]">
        <img
          src={heroImage}
          alt={restaurant.name}
          className="h-full w-full object-cover object-center"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = restaurantPlaceholderImage; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-10 max-padd-container text-white">
          <div className="flex flex-col gap-6 rounded-3xl bg-black/30 p-6 backdrop-blur-md md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300">
                Restaurant
              </p>
              <h1 className="text-3xl font-bold md:text-4xl">
                {restaurant.displayName || restaurant.name}
              </h1>
              {restaurant.brand?.name ? (
                <p className="mt-1 text-sm text-orange-200">
                  Brand · {restaurant.brand.name}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-gray-100">
                {branchAddressLine}
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:gap-6">
              <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1">
                <RatingStars rating={ratingSummary.average || restaurant.rating} />
                <span>
                  {(ratingSummary.average || restaurant.rating || 0).toFixed(1)}{" "}
                  · {ratingSummary.count || restaurant.reviewCount || 0} reviews
                </span>
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 font-semibold uppercase tracking-wide">
                {hoursLabel || "Open daily"}
              </span>
              <span className="rounded-full bg-white/20 px-3 py-1 font-semibold uppercase tracking-wide">
                {restaurant.distanceKm ? restaurant.distanceKm.toFixed(1) : "—"} km away
              </span>
              <a
                href="#customer-reviews"
                className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-orange-600"
              >
                View reviews
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="max-padd-container">
        <div className="space-y-6 lg:grid lg:grid-cols-[280px,1fr] lg:gap-6 lg:space-y-0">
          <aside className="self-start rounded-3xl bg-white p-6 shadow-sm transition lg:sticky lg:top-28">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-gray-900">
                Menu categories
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryOpen((prev) => !prev)}
                className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-500 transition hover:bg-orange-50"
              >
                {isCategoryOpen ? "Hide" : "Show"}
              </button>
            </div>
            <div className={isCategoryOpen ? "mt-4 space-y-2" : "mt-4 hidden"}>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`w-full rounded-2xl px-4 py-2 text-left text-sm font-semibold transition ${
                    activeCategory === category
                      ? "bg-orange-500 text-white"
                      : "bg-orange-50 text-gray-600 hover:bg-orange-100"
                  }`}
                >
                  {category === "all" ? "All dishes" : category}
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 text-sm text-gray-600 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">
                  Contact information
                </h4>
                {restaurant?.name ? (
                  <p className="text-xs uppercase text-orange-500">
                    {restaurant.name}
                  </p>
                ) : null}
                <p className="mt-3 font-semibold text-gray-800">
                  {contactPhone || "Updating phone number"}
                </p>
                {contactEmail ? (
                  <p className="text-sm text-gray-500">{contactEmail}</p>
                ) : null}
                <p>{branchAddressLine || restaurant.mapHint}</p>
                <p className="mt-3 text-xs uppercase text-orange-500">
                  Fast delivery · Friendly packaging · Secure payments
                </p>
                {isBranchOpen !== null || todaysBranchHours ? (
                  <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 text-sm text-gray-700">
                    <p className="text-xs uppercase text-orange-500">
                      Branch hours today
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {isBranchOpen === null
                        ? "Hours updating"
                        : isBranchOpen
                          ? "Open now"
                          : "Closed"}
                    </p>
                    {todaysBranchHours ? (
                      <p className="text-xs text-gray-500">
                        {todaysBranchHours.openTime} - {todaysBranchHours.closeTime}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="rounded-3xl bg-orange-50/80 p-6 text-sm text-gray-700 shadow-sm">
                <h4 className="text-base font-semibold text-orange-600">
                  Current promotions
                </h4>
                <ul className="mt-3 space-y-2">
                  {restaurant.promotions?.length
                    ? restaurant.promotions.map((promotion) => (
                        <li key={promotion.id}>
                          <p className="font-semibold text-gray-900">
                            {promotion.title}
                          </p>
                          <p className="text-xs text-orange-500">
                            {promotion.description}
                          </p>
                        </li>
                      ))
                    : "No promotions available at the moment."}
                </ul>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Find dishes
                      <input
                        type="search"
                        value={dishSearch}
                        onChange={(event) => setDishSearch(event.target.value)}
                        placeholder="Enter a dish name, ingredient, or tag..."
                        className="mt-2 w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setDishSearch("")}
                      className="mt-9 hidden rounded-full border border-orange-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-orange-500 transition hover:bg-orange-50 lg:inline-block"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid flex-1 gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase text-gray-500">
                    Max price ({currency}
                    {maxPrice.toLocaleString()})
                    <input
                      type="range"
                      min={50000}
                      max={500000}
                      step={5000}
                      value={maxPrice}
                      onChange={(event) =>
                        setMaxPrice(Number(event.target.value))
                      }
                      className="mt-2 w-full accent-orange-500"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase text-gray-500">
                    Minimum rating ({minRating.toFixed(1)} stars)
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.5}
                      value={minRating}
                      onChange={(event) =>
                        setMinRating(Number(event.target.value))
                      }
                      className="mt-2 w-full accent-orange-500"
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSortOption(option.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      sortOption === option.id
                        ? "bg-orange-500 text-white"
                        : "bg-orange-50 text-gray-600 hover:bg-orange-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {paginatedDishes.map((dish) => (
                <DishCard
                  key={dish._id}
                  dish={dish}
                  restaurantId={restaurant?.id || branchId}
                  currency={currency}
                  onAdd={(id, size) => {
                    if (isBranchOpen === false) {
                      toast.error('This branch is currently closed. Please try again later.');
                      return;
                    }
                    addToCart(id, size, 1, {
                      branchId: restaurant?.branchId || restaurant?.id || branchId,
                      branchName: restaurant?.displayName || restaurant?.name || null,
                    });
                  }}
                  isDisabled={isBranchOpen === false}
                />
              ))}
              {!paginatedDishes.length && (
                <p className="rounded-3xl bg-white p-6 text-center text-gray-500 shadow">
                  No dishes match your current filters. Try adjusting the search
                  or filter options.
                </p>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    currentPage === 1
                      ? "cursor-not-allowed bg-gray-100 text-gray-400"
                      : "bg-orange-500 text-white hover:bg-orange-600"
                  }`}
                >
                  Previous
                </button>
                <div className="flex flex-wrap justify-center gap-2">
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                        currentPage === pageNumber
                          ? "bg-orange-500 text-white"
                          : "bg-orange-50 text-gray-600 hover:bg-orange-100"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>
                <div className="text-sm font-semibold text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    currentPage === totalPages
                      ? "cursor-not-allowed bg-gray-100 text-gray-400"
                      : "bg-orange-500 text-white hover:bg-orange-600"
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="customer-reviews"
        className="max-padd-container space-y-6 pb-12 pt-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Guest reviews
            </h2>
            <p className="text-sm text-gray-500">
              Only verified customers can leave feedback. Based on{" "}
              {ratingSummary.count || restaurant.reviewCount || 0} verified
              reviews.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-3 shadow-sm">
            <span className="text-3xl font-bold text-orange-500">
              {(ratingSummary.average || restaurant.rating || 0).toFixed(1)}
            </span>
            <div>
              <RatingStars rating={ratingSummary.average || restaurant.rating} />
              <p className="text-xs uppercase text-gray-400">
                Verified reviews
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {reviewsForRestaurant.map((review) => (
            <article
              key={review.id}
              className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <img
                    src={review.avatar}
                    alt={review.customerName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {review.customerName}
                    </p>
                    <p className="text-xs text-gray-400">
                      Verified order ·{" "}
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RatingStars rating={review.rating} />
                  <span className="text-sm font-semibold text-gray-600">
                    {review.rating.toFixed(1)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{review.comment}</p>
              {review.photos?.length ? (
                <div className="flex gap-3">
                  {review.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={review.dishes?.[index]?.title || "Dish"}
                      className="h-24 w-24 rounded-2xl object-cover"
                    />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-600">
                  Order {review.orderId}
                </span>
                {review.dishes?.map((dish) => (
                  <span
                    key={dish.dishId}
                    className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600"
                  >
                    {dish.title}
                  </span>
                ))}
              </div>
              {review.ownerReply ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Restaurant replied</p>
                  <p className="mt-1">{review.ownerReply}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {review.ownerReplyAt
                      ? new Date(review.ownerReplyAt).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Just now"}
                  </p>
                </div>
              ) : null}
            </article>
          ))}
          {!reviewsForRestaurant.length && (
            <p className="rounded-3xl bg-white p-6 text-center text-gray-500 shadow">
              This restaurant has not received any reviews yet. Place an order
              and be the first to share your experience!
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default RestaurantDetail;
