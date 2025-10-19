import React, { useEffect, useMemo, useState } from "react";
import RestaurantCard from "../components/RestaurantCard";
import { useAppContext } from "../context/AppContext";

const sorters = {
  "rating-desc": {
    label: "Highest rated",
    fn: (a, b) => b.rating - a.rating,
  },
  "distance-asc": {
    label: "Closest first",
    fn: (a, b) => a.distanceKm - b.distanceKm,
  },
  "reviews-desc": {
    label: "Most reviewed",
    fn: (a, b) => (b.reviewCount || 0) - (a.reviewCount || 0),
  },
};

const Restaurants = () => {
  const {
    restaurants,
    searchQuery,
    setSearchQuery,
    catalogLoading,
    catalogError,
    refreshCatalog,
  } = useAppContext();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("rating-desc");

  useEffect(() => {
    const controller = new AbortController();
    refreshCatalog({ signal: controller.signal });
    return () => controller.abort();
  }, [refreshCatalog]);

  const categories = useMemo(() => {
    const all = new Set(["all"]);
    restaurants.forEach((restaurant) =>
      restaurant.categories?.forEach((category) => all.add(category))
    );
    return [...all];
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    return restaurants
      .filter((restaurant) => {
        const matchesSearch =
          !searchQuery ||
          restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          restaurant.tags?.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          );
        const matchesCategory =
          selectedCategory === "all" ||
          restaurant.categories?.includes(selectedCategory);
        return matchesSearch && matchesCategory;
      })
      .sort(sorters[sortBy]?.fn || sorters["rating-desc"].fn);
  }, [restaurants, searchQuery, selectedCategory, sortBy]);

  return (
    <div className="max-padd-container space-y-10 py-24">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Restaurants near you
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Discover local favourites, seasonal specials, and must-try places.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, cuisine, or tag"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 sm:min-w-[260px]"
          />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          >
            {Object.entries(sorters).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedCategory === category
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {catalogError ? (
        <div className="rounded-3xl bg-red-50 p-6 text-center text-red-600 shadow">
          {catalogError}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {catalogLoading && !filteredRestaurants.length ? (
          <p className="col-span-full rounded-3xl bg-white p-6 text-center text-gray-500 shadow">
            Loading restaurants...
          </p>
        ) : null}
        {filteredRestaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
        {!catalogLoading && !filteredRestaurants.length && !catalogError && (
          <p className="rounded-3xl bg-white p-6 text-center text-gray-500 shadow">
            We could not find restaurants that match your filters yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default Restaurants;
