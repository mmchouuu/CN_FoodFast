import React from "react";
import { Link } from "react-router-dom";
import RatingStars from "./RatingStars";

const RestaurantCard = ({ restaurant, variant = "default" }) => {
  if (!restaurant) return null;

  return (
    <Link
      to={`/restaurants/${restaurant.id}`}
      className={`group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
        variant === "compact" ? "sm:flex-row" : ""
      }`}
    >
      <div
        className={`relative w-full ${
          variant === "compact" ? "sm:w-48" : ""
        } aspect-[4/3] overflow-hidden`}
      >
        <img
          src={restaurant.coverImage}
          alt={restaurant.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-500 shadow">
          {restaurant.tags?.[0] || "Nổi bật"}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {restaurant.name}
            </h3>
            <p className="text-sm text-gray-500">{restaurant.address}</p>
          </div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
            {restaurant.distanceKm.toFixed(1)} km
          </span>
        </div>

        <RatingStars rating={restaurant.rating} />

        <div className="flex flex-wrap gap-2">
          {restaurant.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {restaurant.promotions?.length ? (
          <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
            <p className="font-medium">
              {restaurant.promotions[0].title}
            </p>
            <p className="text-xs text-orange-500">{restaurant.promotions[0].description}</p>
          </div>
        ) : null}
      </div>
    </Link>
  );
};

export default RestaurantCard;
