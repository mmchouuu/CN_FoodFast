import React, { useState } from "react";
import { Link } from "react-router-dom";
import { assets } from "../assets/data";
import { useAppContext } from "../context/AppContext";
import {
  dishPlaceholderImage,
  pickFirstImageUrl,
} from "../utils/imageHelpers";

const Item = ({ product }) => {
  const { currency, addToCart } = useAppContext();
  const [size, setSize] = useState(product.sizes?.[0] || "");

  if (!product) return null;

  const productImage = pickFirstImageUrl(
    dishPlaceholderImage,
    product.images,
    product.image,
    product.heroImage,
  );

  const description =
    product.description?.trim() ||
    "Khám phá thêm hương vị đặc biệt của món ăn này.";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        to={`/restaurants/${product.restaurantId}/dishes/${product._id}`}
        className="relative aspect-[4/3] overflow-hidden bg-orange-50"
      >
        <img
          src={productImage}
          alt={product.title}
          className="h-full w-full object-cover object-center transition duration-300 hover:scale-105"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = dishPlaceholderImage; }}
        />
        {product.tags?.[0] ? (
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-500 shadow">
            {product.tags[0]}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {product.title}
            </h3>
            <p className="text-xs uppercase text-gray-400">
              {product.category}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
            <img src={assets.star} alt="rating" className="h-3 w-3" />
            <span>{(product.rating || 4.7).toFixed(1)}</span>
          </div>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2">
          {description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {product.sizes?.map((option) => (
              <button
                key={option}
                onClick={() => setSize(option)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  size === option
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-orange-100 bg-white text-gray-600 hover:border-orange-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="text-lg font-semibold text-orange-500">
            {currency}
            {size && product.price?.[size]
              ? product.price[size].toLocaleString()
              : 0}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div>
              <p className="font-semibold text-gray-700">Prep</p>
              <p>
                {product.preparation?.prepMinutes || 5}
                {" "}
                minutes
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Cook</p>
              <p>
                {product.preparation?.cookMinutes || 15}
                {" "}
                minutes
              </p>
            </div>
          </div>
          <button
            onClick={() => addToCart(product._id, size)}
            className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
          >
            Add to cart
          </button>
        </div>

        <Link
          to={`/restaurants/${product.restaurantId}/dishes/${product._id}`}
          className="text-xs font-semibold text-orange-500 hover:underline"
        >
          View details
        </Link>
      </div>
    </div>
  );
};

export default Item;
