import React, { useEffect, useMemo, useState } from "react";
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

  const optionGroups = useMemo(
    () => (Array.isArray(dish?.options) ? dish.options : []),
    [dish]
  );
  const [selectionMap, setSelectionMap] = useState({});
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!dish) return;
    const initialSelections = {};
    optionGroups.forEach((group) => {
      const values = Array.isArray(group.values) ? group.values : [];
      if (!values.length) {
        initialSelections[group.id] = [];
        return;
      }
      if (group.type === "single") {
        initialSelections[group.id] = [values[0]];
      } else if (group.minSelect && group.minSelect > 0) {
        initialSelections[group.id] = values.slice(0, group.minSelect);
      } else {
        initialSelections[group.id] = [];
      }
    });
    setSelectionMap(initialSelections);
    setSelectedToppings([]);
    setQuantity(1);
  }, [dishId, dish, optionGroups]);

  const extractOptionId = (value) =>
    value?.id ?? value?.value ?? value?.label ?? "";

  const getSelectedValues = (groupId) => selectionMap[groupId] || [];

  const isValueSelected = (group, value) =>
    getSelectedValues(group.id).some(
      (item) => extractOptionId(item) === extractOptionId(value)
    );

  const sizeGroup = useMemo(() => {
    return optionGroups.find(
      (group) =>
        group.type === "single" &&
        group.required !== false &&
        (group.name || "").toLowerCase().includes("size")
    ) || optionGroups.find((group) => group.type === "single");
  }, [optionGroups]);

  const selectedSizeValue = sizeGroup
    ? getSelectedValues(sizeGroup.id)?.[0] || null
    : null;

  const selectedSizeLabel =
    selectedSizeValue?.label ||
    selectedSizeValue?.name ||
    dish?.sizes?.[0] ||
    (dish?.price ? Object.keys(dish.price)[0] : "Standard");

  const sizePriceDelta = selectedSizeValue?.priceDelta || 0;

  const toppingsPrice = selectedToppings.reduce((total, toppingId) => {
    const topping = dish.toppings?.find((item) => item.id === toppingId);
    return total + (topping?.priceDelta || 0);
  }, 0);

  const otherOptionGroups = useMemo(() => {
    if (!sizeGroup) return optionGroups;
    return optionGroups.filter((group) => group.id !== sizeGroup.id);
  }, [optionGroups, sizeGroup]);

  const otherOptionTotal = otherOptionGroups.reduce((sum, group) => {
    const values = getSelectedValues(group.id);
    if (!Array.isArray(values) || !values.length) return sum;
    return (
      sum +
      values.reduce(
        (valueSum, value) => valueSum + (value?.priceDelta || 0),
        0
      )
    );
  }, 0);

  const baseUnitPrice =
    dish?.basePrice ??
    dish?.price?.[selectedSizeLabel] ??
    dish?.price?.Standard ??
    0;

  const subtotalPerUnit =
    baseUnitPrice + sizePriceDelta + otherOptionTotal + toppingsPrice;

  const taxRate =
    dish?.taxRate ??
    (dish?.basePrice > 0 && dish?.priceWithTax
      ? Math.max(dish.priceWithTax - dish.basePrice, 0) / dish.basePrice
      : 0);

  const safeSubtotalPerUnit = Math.max(subtotalPerUnit, 0);
  const taxPerUnit = Math.max(safeSubtotalPerUnit * taxRate, 0);
  const totalPerUnit = safeSubtotalPerUnit + taxPerUnit;
  const subtotalTotal = safeSubtotalPerUnit * quantity;
  const taxTotal = taxPerUnit * quantity;
  const totalPrice = totalPerUnit * quantity;

  const handleToggleTopping = (toppingId) => {
    setSelectedToppings((prev) =>
      prev.includes(toppingId)
        ? prev.filter((id) => id !== toppingId)
        : [...prev, toppingId]
    );
  };

  const handleOptionChange = (group, value) => {
    if (!group || !value) return;
    setSelectionMap((prev) => {
      const current = prev[group.id] || [];
      const valueId = extractOptionId(value);
      const exists = current.some(
        (item) => extractOptionId(item) === valueId
      );

      if (group.type === "single") {
        return {
          ...prev,
          [group.id]: [value],
        };
      }

      if (exists) {
        const filtered = current.filter(
          (item) => extractOptionId(item) !== valueId
        );
        if (group.minSelect && group.minSelect > 0 && filtered.length < group.minSelect) {
          return prev;
        }
        return {
          ...prev,
          [group.id]: filtered,
        };
      }

      let next = [...current, value];
      if (
        group.maxSelect &&
        group.maxSelect > 0 &&
        next.length > group.maxSelect
      ) {
        next = next.slice(next.length - group.maxSelect);
      }
      return {
        ...prev,
        [group.id]: next,
      };
    });
  };

  const handleQuantityChange = (delta) => {
    setQuantity((prev) => {
      const next = prev + delta;
      return next < 1 ? 1 : next;
    });
  };

  const selectedToppingItems = useMemo(
    () =>
      (dish?.toppings || []).filter((topping) =>
        selectedToppings.includes(topping.id)
      ),
    [dish, selectedToppings]
  );

  const optionSummary = useMemo(() => {
    const summary = [];
    otherOptionGroups.forEach((group) => {
      const values = selectionMap[group.id] || [];
      if (!Array.isArray(values) || !values.length) return;
      summary.push({
        id: group.id,
        name: group.name || "Option",
        values: values.map((value) => ({
          id: extractOptionId(value),
          label: value.label || value.name,
          priceDelta: value.priceDelta || 0,
        })),
      });
    });
    if (selectedToppingItems.length) {
      summary.push({
        id: "toppings",
        name: "Toppings",
        values: selectedToppingItems.map((item) => ({
          id: item.id,
          label: item.label,
          priceDelta: item.priceDelta || 0,
        })),
      });
    }
    return summary;
  }, [otherOptionGroups, selectionMap, selectedToppingItems]);

  const signature = useMemo(() => {
    const parts = [];
    if (sizeGroup && selectedSizeValue) {
      parts.push(extractOptionId(selectedSizeValue));
    }
    optionSummary.forEach((group) => {
      group.values.forEach((value) => {
        parts.push(value.id || value.label);
      });
    });
    return parts.length ? parts.sort().join("|") : "base";
  }, [optionSummary, sizeGroup, selectedSizeValue]);

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

  const handleAddToCart = () => {
    if (sizeGroup && !selectedSizeValue) {
      return;
    }
    addToCart({
      productId: dish._id,
      size: selectedSizeLabel,
      quantity,
      signature,
      options: optionSummary,
      basePrice: baseUnitPrice,
      sizePriceDelta,
      optionPriceTotal: otherOptionTotal + toppingsPrice,
      subtotal: safeSubtotalPerUnit,
      taxRate,
      taxAmount: taxPerUnit,
      unitPrice: totalPerUnit,
    });
  };

  const dishImage = pickFirstImageUrl(
    dishPlaceholderImage,
    dish.images,
    dish.image,
    dish.heroImage,
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-16 py-24 px-6">
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

      <div className="flex flex-col gap-12 lg:flex-row lg:gap-16 max-w-[1280px] mx-auto">
        <div className="lg:w-[520px]">
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

          {sizeGroup ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">
                {sizeGroup.name || "Choose a size"}
              </h2>
              <div className="flex flex-wrap gap-3">
                {(sizeGroup.values || []).map((value) => {
                  const selected = isValueSelected(sizeGroup, value);
                  return (
                    <button
                      key={value.id || value.label}
                      onClick={() => handleOptionChange(sizeGroup, value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        selected
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
          ) : null}

          {otherOptionGroups.length ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Customize your dish
              </h2>
              {otherOptionGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-orange-400">
                    {group.name}
                    {group.required ? " *" : ""}
                  </p>
                  {group.type === "single" ? (
                    <div className="flex flex-wrap gap-2">
                      {(group.values || []).map((value) => {
                        const selected = isValueSelected(group, value);
                        return (
                          <button
                            key={value.id || value.label}
                            onClick={() => handleOptionChange(group, value)}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                              selected
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
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {(group.values || []).map((value) => {
                        const selected = isValueSelected(group, value);
                        return (
                          <label
                            key={value.id || value.label}
                            className="flex cursor-pointer items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-xs text-gray-600 transition hover:border-orange-300"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => handleOptionChange(group, value)}
                                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                              />
                              <span>{value.label}</span>
                            </div>
                            {value.priceDelta ? (
                              <span className="text-[11px] font-semibold text-gray-500">
                                +{currency}
                                {value.priceDelta.toLocaleString()}
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  )}
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
                Subtotal
              </span>
              <span className="text-sm font-semibold text-gray-700">
                {currency}
                {subtotalTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">
                VAT ({(taxRate * 100).toFixed(1)}%)
              </span>
              <span className="text-sm font-semibold text-gray-700">
                {currency}
                {taxTotal.toLocaleString()}
              </span>
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
            <p className="text-xs text-gray-400">
              Unit price (incl. VAT): {currency}
              {totalPerUnit.toLocaleString()}
            </p>
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
        <div className="flex gap-8 overflow-x-auto pb-8 scroll-smooth snap-x snap-mandatory no-scrollbar">
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
                className="group flex w-[320px] flex-col snap-start flex-shrink-0 overflow-hidden rounded-3xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-lg"
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
