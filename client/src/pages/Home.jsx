import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import PromotionCarousel from "../components/PromotionCarousel";
import RestaurantCard from "../components/RestaurantCard";
import Item from "../components/Item";
import RestaurantBestSellerCard from "../components/RestaurantBestSellerCard";

const Home = () => {
  const { restaurants, products, currency, searchQuery } = useAppContext();

  const popularRestaurants = useMemo(() => {
    return [...restaurants]
      .filter((restaurant) =>
        searchQuery
          ? restaurant.name
              .toLowerCase()
              .includes(searchQuery.trim().toLowerCase())
          : true
      )
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
      .slice(0, 6);
  }, [restaurants, searchQuery]);

  const nearbyRestaurants = useMemo(() => {
    return restaurants
      .filter((restaurant) => restaurant.distanceKm <= 3.5)
      .slice(0, 6);
  }, [restaurants]);

  const bestSellerCombos = useMemo(() => {
    const dishesByRestaurant = products.reduce((map, dish) => {
      if (!map[dish.restaurantId]) {
        map[dish.restaurantId] = [];
      }
      map[dish.restaurantId].push(dish);
      return map;
    }, {});

    return restaurants
      .filter((restaurant) => restaurant.distanceKm <= 4)
      .map((restaurant) => {
        const dishes = dishesByRestaurant[restaurant.id] || [];
        const bestSeller = [...dishes]
          .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
          .shift();
        return bestSeller ? { restaurant, dish: bestSeller } : null;
      })
      .filter(Boolean);
  }, [restaurants, products]);

  const highlightedDishes = useMemo(() => {
    return [...products]
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
      .slice(0, 6);
  }, [products]);

  return (
    <div className="space-y-16 pb-24">
      <div className="bg-gradient-to-br from-orange-100 via-white to-amber-50 pb-16">
        <PromotionCarousel />
      </div>

      <div className="max-padd-container space-y-16">
        <section className="space-y-6" id="popular-restaurants">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Most-loved restaurants
              </h2>
              <p className="text-sm text-gray-500">
                Standout picks with stellar ratings and speedy delivery.
              </p>
            </div>
            <Link
              to="/restaurants"
              className="text-sm font-semibold text-orange-500 transition hover:text-orange-600"
            >
              View all restaurants
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {popularRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
            {!popularRestaurants.length && (
              <p className="rounded-3xl bg-white p-6 text-center text-gray-500 shadow">
                No restaurants match your filters yet. Try broadening your search.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6" id="nearby-restaurants">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Nearby restaurants
              </h2>
              <p className="text-sm text-gray-500">
                Delivery spots within 15 minutes of your location.
              </p>
            </div>
            <Link
              to="/restaurants?filter=nearby"
              className="text-sm font-semibold text-orange-500 transition hover:text-orange-600"
            >
              View nearby map
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {nearbyRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
            {!nearbyRestaurants.length && (
              <p className="rounded-3xl bg-white p-6 text-center text-gray-500 shadow">
                We are expanding service to your area soon. Please check back later!
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6" id="best-sellers">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Weekly best sellers
              </h2>
              <p className="text-sm text-gray-500">
                Dishes diners near you can’t stop ordering right now.
              </p>
            </div>
            <Link
              to="/restaurants?filter=best-seller"
              className="text-sm font-semibold text-orange-500 transition hover:text-orange-600"
            >
              See more highlights
            </Link>
          </div>

          <div className="no-scrollbar flex snap-x gap-6 overflow-x-auto pb-4">
            {bestSellerCombos.map((combo) => (
              <div key={`${combo.restaurant.id}-${combo.dish._id}`} className="snap-start">
                <RestaurantBestSellerCard
                  restaurant={combo.restaurant}
                  dish={combo.dish}
                  currency={currency}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6" id="trending-dishes">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Personalized picks for you
            </h2>
            <Link
              to="/restaurants"
              className="text-sm font-semibold text-orange-500 transition hover:text-orange-600"
            >
              Explore the menu
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {highlightedDishes.map((dish) => (
              <Item key={dish._id} product={dish} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
