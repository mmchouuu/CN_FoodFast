import React from "react";
import { Link } from "react-router-dom";
import RatingStars from "./RatingStars";

const RestaurantBestSellerCard = ({ restaurant, dish, currency }) => {
  if (!restaurant || !dish) return null;

  const price =
    dish.sizes && dish.sizes.length
      ? dish.price?.[dish.sizes[0]] ?? Object.values(dish.price ?? {})[0]
      : Object.values(dish.price ?? {})[0];
  const dishRating = dish.rating ?? restaurant.rating ?? 4.5;
  const dishReviews = dish.reviewCount ?? restaurant.reviewCount ?? 0;
  const tagLine =
    restaurant.tags?.slice(0, 2).join("  ·  ") || "Loved by diners";

  return (
    <article className="flex w-[320px] flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:w-[360px]">
      <Link
        to={`/restaurants/${restaurant.id}/dishes/${dish._id}`}
        className="relative h-48 overflow-hidden"
        aria-label={`View ${dish.title}`}
      >
        <img
          src={dish.images?.[0]}
          alt={dish.title}
          className="h-full w-full object-cover transition duration-300 hover:scale-105"
        />
        {dish.tags?.[0] ? (
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-500 shadow">
            {dish.tags[0]}
          </span>
        ) : null}
      </Link>
      <div className="flex min-h-[260px] flex-1 flex-col gap-4 p-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            {restaurant.distanceKm.toFixed(1)} km  -  {tagLine}
          </p>
          <h3 className="text-lg font-semibold text-gray-900">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <RatingStars rating={dishRating} />
            <span>
              {dishRating.toFixed(1)}  ·  {dishReviews} reviews
            </span>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-2 rounded-2xl bg-orange-50/80 p-4 text-sm text-gray-700">
          <span className="text-xs uppercase text-orange-500">Best seller</span>
          <p className="text-base font-semibold text-gray-900">{dish.title}</p>
          <p className="line-clamp-2 text-sm text-gray-600">
            {dish.description}
          </p>
          <p className="text-sm font-semibold text-orange-500">
            From {currency}
            {price?.toLocaleString()}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-3">
          <Link
            to={`/restaurants/${restaurant.id}`}
            className="flex-1 rounded-full border border-orange-100 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-500"
          >
            View restaurant
          </Link>
          <Link
            to={`/restaurants/${restaurant.id}/dishes/${dish._id}`}
            className="flex-1 rounded-full bg-orange-500 px-5 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
          >
            Order now
          </Link>
        </div>
      </div>
    </article>
  );
};

export default RestaurantBestSellerCard;
