import React from "react";
import { assets } from "../assets/data";

const RatingStars = ({ rating }) => {
  const stars = Math.round(rating);

  return (
    <div className="flex items-center gap-1 justify-center">
      {[...Array(5)].map((_, i) => (
        <img
          key={i}
          src={assets.star}
          alt="star"
          width={20}
          className={`transition-transform duration-300 ${
            i < stars ? "opacity-100 scale-105" : "opacity-30"
          }`}
        />
      ))}
      <p className="text-gray-700 font-medium ml-2">{rating.toFixed(1)}</p>
    </div>
  );
};

export default RatingStars;
