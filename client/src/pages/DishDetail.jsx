import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  dishPlaceholderImage,
  pickFirstImageUrl,
} from "../utils/imageHelpers";

const DishDetail = () => {
  const { restaurantId, dishId } = useParams();
  const {
    getDishById,
    getRestaurantById,
    getDishesByRestaurant,
    currency,
    addToCart,
  } = useAppContext();

  const dish = getDishById(dishId);
  const restaurant = getRestaurantById(restaurantId);

  const relatedDishes = useMemo(() => {
    return getDishesByRestaurant(restaurantId).filter(
      (item) => item._id !== dishId
    );
  }, [getDishesByRestaurant, restaurantId, dishId]);

  const initialSize =
    dish?.sizes?.[0] || (dish?.price ? Object.keys(dish.price)[0] : "");
  const [selectedSize, setSelectedSize] = useState(initialSize || "");
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [quantity, setQuantity] = useState(1);

  if (!dish) {
    return (
      <div className="max-padd-container py-24 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          This dish is temporarily unavailable
        </h1>
        <Link
          to={`/restaurants/${restaurantId}`}
          className="mt-6 inline-block rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Back to restaurant
        </Link>
      </div>
    );
  }

  const resolveBasePrice = () => {
    if (selectedSize && dish.price?.[selectedSize]) {
      return dish.price[selectedSize];
    }
    const allPrices = Object.values(dish.price || {});
    return typeof allPrices[0] === "number" ? allPrices[0] : 0;
  };

  const basePrice = resolveBasePrice();

  const toppingsPrice = selectedToppings.reduce((total, toppingId) => {
    const topping = dish.toppings?.find((item) => item.id === toppingId);
    return total + (topping?.priceDelta || 0);
  }, 0);

  const optionsPrice = Object.values(selectedOptions).reduce(
    (total, optionValue) => total + (optionValue?.priceDelta || 0),
    0
  );

  const totalPrice = (basePrice + toppingsPrice + optionsPrice) * quantity;

  const handleToggleTopping = (toppingId) => {
    setSelectedToppings((prev) =>
      prev.includes(toppingId)
        ? prev.filter((id) => id !== toppingId)
        : [...prev, toppingId]
    );
  };

  const handleSelectOption = (optionId, valueId) => {
    const option = dish.options?.find((item) => item.id === optionId);
    if (!option) return;
    const value = option.values.find((item) => item.id === valueId);
    setSelectedOptions((prev) => ({
      ...prev,
      [optionId]: value || null,
    }));
  };

  const handleQuantityChange = (delta) => {
    setQuantity((prev) => {
      const next = prev + delta;
      return next < 1 ? 1 : next;
    });
  };

  const handleAddToCart = () => {
    if (!selectedSize && dish.sizes?.length) {
      return;
    }
    addToCart(dish._id, selectedSize || null, quantity);
  };

  const dishImage = pickFirstImageUrl(
    dishPlaceholderImage,
    dish.images,
    dish.image,
    dish.heroImage,
  );

  return (
    <div className="max-padd-container space-y-12 py-24">
      <nav className="text-sm text-gray-500">
        <Link to="/" className="hover:text-orange-500">
          Home
        </Link>{" "}
        /{" "}
        <Link
          to={`/restaurants/${restaurantId}`}
          className="hover:text-orange-500"
        >
          {restaurant?.name || "Restaurant"}
        </Link>{" "}
        / <span className="text-gray-700">{dish.title}</span>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="lg:w-[420px]">
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-orange-50/60">
              <img
                src={dishImage}
                alt={dish.title}
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 rounded-3xl bg-white p-8 shadow-sm">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-gray-900">{dish.title}</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
              {dish.category} · {dish.type}
            </p>
            <p className="text-sm text-gray-600">{dish.description}</p>
          </div>

          <div className="rounded-2xl bg-orange-50/60 p-4 text-sm text-gray-600">
            <p>
              {restaurant?.name} · {restaurant?.distanceKm?.toFixed(1)} km away ·
              Rated {restaurant?.rating?.toFixed(1)}/5
            </p>
            <p>
              Preparation time:{" "}
              {dish.preparation
                ? `${dish.preparation.prepMinutes} min prep · ${dish.preparation.cookMinutes} min cook`
                : "15 – 20 minutes"}
            </p>
          </div>

          {dish.sizes?.length ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Choose a size
              </h2>
              <div className="flex flex-wrap gap-3">
                {dish.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      selectedSize === size
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-orange-100 bg-white text-gray-600 hover:border-orange-300"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {dish.options?.length ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Extras</h2>
              {dish.options.map((option) => (
                <div key={option.id} className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-orange-400">
                    {option.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const isSelected =
                        selectedOptions[option.id]?.id === value.id;
                      return (
                        <button
                          key={value.id}
                          onClick={() =>
                            handleSelectOption(option.id, value.id)
                          }
                          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            isSelected
                              ? "border-orange-500 bg-orange-500 text-white"
                              : "border-orange-100 bg-white text-gray-600 hover:border-orange-300"
                          }`}
                        >
                          {value.label}
                          {value.priceDelta
                            ? ` (+${currency}${value.priceDelta.toLocaleString()})`
                            : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {dish.toppings?.length ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Add toppings
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {dish.toppings.map((topping) => (
                  <label
                    key={topping.id}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-gray-600 transition hover:border-orange-300"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedToppings.includes(topping.id)}
                        onChange={() => handleToggleTopping(topping.id)}
                        className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                      />
                      <span>{topping.label}</span>
                    </div>
                    {topping.priceDelta ? (
                      <span className="text-xs font-semibold text-gray-500">
                        +{currency}
                        {topping.priceDelta.toLocaleString()}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-3xl bg-orange-50/70 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">
                Quantity
              </span>
              <div className="flex items-center gap-3 rounded-full border border-orange-200 bg-white px-3 py-1">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(-1)}
                  className="h-8 w-8 rounded-full text-lg text-orange-500 transition hover:bg-orange-100"
                >
                  -
                </button>
                <span className="w-6 text-center text-sm font-semibold text-gray-700">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleQuantityChange(1)}
                  className="h-8 w-8 rounded-full text-lg text-orange-500 transition hover:bg-orange-100"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">
                Total
              </span>
              <span className="text-2xl font-bold text-orange-500">
                {currency}
                {totalPrice.toLocaleString()}
              </span>
            </div>
            <button
              onClick={handleAddToCart}
              className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          More from {restaurant?.name}
        </h2>
        <div className="no-scrollbar flex gap-5 overflow-x-auto pb-4">
          {relatedDishes.map((item) => {
            const fallbackSize = item.sizes?.[0];
            const base =
              (fallbackSize && item.price?.[fallbackSize]) ||
              Object.values(item.price ?? {})[0];
            const cardImage = pickFirstImageUrl(
              dishPlaceholderImage,
              item.images,
              item.image,
              item.heroImage,
            );
            return (
              <Link
                key={item._id}
                to={`/restaurants/${restaurantId}/dishes/${item._id}`}
                className="group flex w-[260px] flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={cardImage}
                    alt={item.title}
                    className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105"
                  />
                  {item.tags?.[0] ? (
                    <span className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-500 shadow">
                      {item.tags[0]}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 px-5 py-5">
                  <h3 className="text-base font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-xs uppercase text-gray-400">
                    {item.category}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-3">
                    {item.description}
                  </p>
                  <p className="text-sm font-semibold text-orange-500">
                    From {currency}
                    {base?.toLocaleString()}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default DishDetail;
