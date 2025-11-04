// import React, { useEffect, useMemo, useState } from "react";
// import { Link, useParams } from "react-router-dom";
// import { useAppContext } from "../context/AppContext";
// import {
//   dishPlaceholderImage,
//   pickFirstImageUrl,
// } from "../utils/imageHelpers";


// const DishDetail = () => {
//   const { restaurantId, dishId } = useParams();
//   const {
//     getDishById,
//     getRestaurantById,
//     getDishesByRestaurant,
//     currency,
//     addToCart,
//   } = useAppContext();

//   const dish = getDishById(dishId);

//   const restaurant = getRestaurantById(restaurantId);

//   const relatedDishes = useMemo(() => {
//     return getDishesByRestaurant(restaurantId).filter(
//       (item) => item._id !== dishId
//     );
//   }, [getDishesByRestaurant, restaurantId, dishId]);

//   const optionGroups = useMemo(
//     () => (Array.isArray(dish?.options) ? dish.options : []),
//     [dish]
//   );
//   const [selectionMap, setSelectionMap] = useState({});
//   const [quantity, setQuantity] = useState(1);

//   const formatVnd = (amount) => {
//     const numeric = Number(amount);
//     if (!Number.isFinite(numeric)) return `0\u20AB`;
//     return `${Math.abs(numeric).toLocaleString("vi-VN")}\u20AB`;
//   };

//   const formatOptionPrice = (amount) => {
//     const numeric = Number(amount);
//     if (!Number.isFinite(numeric) || numeric === 0) {
//       return `(0\u20AB)`;
//     }
//     const prefix = numeric > 0 ? "+" : "-";
//     return `(${prefix}${formatVnd(Math.abs(numeric))})`;
//   };

//   useEffect(() => {
//     if (!dish) return;
//     const initialSelections = {};
//     optionGroups.forEach((group) => {
//       const values = Array.isArray(group.values) ? group.values : [];
//       if (!values.length) {
//         initialSelections[group.id] = [];
//         return;
//       }
//       if (group.type === "single") {
//         initialSelections[group.id] = [values[0]];
//       } else if (group.minSelect && group.minSelect > 0) {
//         initialSelections[group.id] = values.slice(0, group.minSelect);
//       } else {
//         initialSelections[group.id] = [];
//       }
//     });
//     setSelectionMap(initialSelections);
//     setQuantity(1);
//   }, [dishId, dish, optionGroups]);

//   const extractOptionId = (value) =>
//     value?.id ?? value?.value ?? value?.label ?? "";

//   const getSelectedValues = (groupId) => selectionMap[groupId] || [];

//   const isValueSelected = (group, value) =>
//     getSelectedValues(group.id).some(
//       (item) => extractOptionId(item) === extractOptionId(value)
//     );

//   const sizeGroup = useMemo(() => {
//     return optionGroups.find(
//       (group) =>
//         group.type === "single" &&
//         group.required !== false &&
//         (group.name || "").toLowerCase().includes("size")
//     ) || optionGroups.find((group) => group.type === "single");
//   }, [optionGroups]);

//   const selectedSizeValue = sizeGroup
//     ? getSelectedValues(sizeGroup.id)?.[0] || null
//     : null;

//   const selectedSizeLabel =
//     selectedSizeValue?.label ||
//     selectedSizeValue?.name ||
//     dish?.sizes?.[0] ||
//     (dish?.price ? Object.keys(dish.price)[0] : "Standard");

//   const sizePriceDelta = selectedSizeValue?.priceDelta || 0;

//   const otherOptionGroups = useMemo(() => {
//     if (!sizeGroup) return optionGroups;
//     return optionGroups.filter((group) => group.id !== sizeGroup.id);
//   }, [optionGroups, sizeGroup]);

//   const toppingGroup = useMemo(() => {
//     if (!otherOptionGroups.length) return null;
//     const explicit = otherOptionGroups.find((group) => {
//       if (!group) return false;
//       const label = (group.name || "").toLowerCase();
//       return (
//         group.type === "multiple" &&
//         (label.includes("topping") ||
//           label.includes("add-on") ||
//           label.includes("extra"))
//       );
//     });
//     if (explicit) return explicit;
//     if (
//       otherOptionGroups.length === 1 &&
//       otherOptionGroups[0]?.type === "multiple"
//     ) {
//       return otherOptionGroups[0];
//     }
//     return null;
//   }, [otherOptionGroups]);

//   const customizableGroups = useMemo(() => {
//     if (!toppingGroup) return otherOptionGroups;
//     return otherOptionGroups.filter((group) => group.id !== toppingGroup.id);
//   }, [otherOptionGroups, toppingGroup]);

//   const selectedToppingValues = useMemo(() => {
//     if (!toppingGroup) return [];
//     const values = getSelectedValues(toppingGroup.id);
//     return Array.isArray(values) ? values : [];
//   }, [toppingGroup, selectionMap]);

//   const toppingsPrice = selectedToppingValues.reduce(
//     (total, value) => total + (value?.priceDelta || 0),
//     0
//   );

//   const customOptionTotal = customizableGroups.reduce((sum, group) => {
//     const values = getSelectedValues(group.id);
//     if (!Array.isArray(values) || !values.length) return sum;
//     return (
//       sum +
//       values.reduce(
//         (valueSum, value) => valueSum + (value?.priceDelta || 0),
//         0
//       )
//     );
//   }, 0);

//   const baseUnitPrice =
//     dish?.basePrice ??
//     dish?.price?.[selectedSizeLabel] ??
//     dish?.price?.Standard ??
//     0;

//   const subtotalPerUnit =
//     baseUnitPrice + sizePriceDelta + customOptionTotal + toppingsPrice;

//   const taxRate =
//     dish?.taxRate ??
//     (dish?.basePrice > 0 && dish?.priceWithTax
//       ? Math.max(dish.priceWithTax - dish.basePrice, 0) / dish.basePrice
//       : 0);

//   const safeSubtotalPerUnit = Math.max(subtotalPerUnit, 0);
//   const taxPerUnit = Math.max(safeSubtotalPerUnit * taxRate, 0);
//   const totalPerUnit = safeSubtotalPerUnit + taxPerUnit;
//   const subtotalTotal = safeSubtotalPerUnit * quantity;
//   const taxTotal = taxPerUnit * quantity;
//   const totalPrice = totalPerUnit * quantity;

//   const handleOptionChange = (group, value) => {
//     if (!group || !value) return;
//     setSelectionMap((prev) => {
//       const current = prev[group.id] || [];
//       const valueId = extractOptionId(value);
//       const exists = current.some(
//         (item) => extractOptionId(item) === valueId
//       );

//       if (group.type === "single") {
//         return {
//           ...prev,
//           [group.id]: [value],
//         };
//       }

//       if (exists) {
//         const filtered = current.filter(
//           (item) => extractOptionId(item) !== valueId
//         );
//         if (group.minSelect && group.minSelect > 0 && filtered.length < group.minSelect) {
//           return prev;
//         }
//         return {
//           ...prev,
//           [group.id]: filtered,
//         };
//       }

//       let next = [...current, value];
//       if (
//         group.maxSelect &&
//         group.maxSelect > 0 &&
//         next.length > group.maxSelect
//       ) {
//         next = next.slice(next.length - group.maxSelect);
//       }
//       return {
//         ...prev,
//         [group.id]: next,
//       };
//     });
//   };

//   const handleQuantityChange = (delta) => {
//     setQuantity((prev) => {
//       const next = prev + delta;
//       return next < 1 ? 1 : next;
//     });
//   };

//   const optionSummary = useMemo(() => {
//     const summary = [];
//     customizableGroups.forEach((group) => {
//       const values = getSelectedValues(group.id);
//       if (!Array.isArray(values) || !values.length) return;
//       summary.push({
//         id: group.id,
//         name: group.name || "Option",
//         values: values.map((value) => ({
//           id: extractOptionId(value),
//           label: value.label || value.name,
//           priceDelta: value.priceDelta || 0,
//         })),
//       });
//     });
//     if (toppingGroup && selectedToppingValues.length) {
//       summary.push({
//         id: toppingGroup.id,
//         name: toppingGroup.name || "Toppings",
//         values: selectedToppingValues.map((value) => ({
//           id: extractOptionId(value),
//           label: value.label || value.name,
//           priceDelta: value.priceDelta || 0,
//         })),
//       });
//     }
//     return summary;
//   }, [customizableGroups, selectedToppingValues, toppingGroup, selectionMap]);

//   const signature = useMemo(() => {
//     const parts = [];
//     if (sizeGroup && selectedSizeValue) {
//       parts.push(extractOptionId(selectedSizeValue));
//     }
//     optionSummary.forEach((group) => {
//       group.values.forEach((value) => {
//         parts.push(value.id || value.label);
//       });
//     });
//     return parts.length ? parts.sort().join("|") : "base";
//   }, [optionSummary, sizeGroup, selectedSizeValue]);

//   if (!dish) {
//     return (
//       <div className="max-padd-container py-24 text-center">
//         <h1 className="text-3xl font-bold text-gray-900">
//           This dish is temporarily unavailable
//         </h1>
//         <Link
//           to={`/restaurants/${restaurantId}`}
//           className="mt-6 inline-block rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
//         >
//           Back to restaurant
//         </Link>
//       </div>
//     );
//   }

//   const handleAddToCart = () => {
//     if (sizeGroup && !selectedSizeValue) {
//       return;
//     }
//     addToCart({
//       productId: dish._id,
//       size: selectedSizeLabel,
//       quantity,
//       signature,
//       options: optionSummary,
//       basePrice: baseUnitPrice,
//       sizePriceDelta,
//       optionPriceTotal: customOptionTotal + toppingsPrice,
//       subtotal: safeSubtotalPerUnit,
//       taxRate,
//       taxAmount: taxPerUnit,
//       unitPrice: totalPerUnit,
//     });
//   };

//   const dishImage = pickFirstImageUrl(
//     dishPlaceholderImage,
//     dish.images,
//     dish.image,
//     dish.heroImage,
//   );

//   return (
//     <div className="max-w-[1400px] mx-auto space-y-16 py-24 px-6">
//       <nav className="text-sm text-gray-500">
//         <Link to="/" className="hover:text-orange-500">
//           Home
//         </Link>{" "}
//         /{" "}
//         <Link
//           to={`/restaurants/${restaurantId}`}
//           className="hover:text-orange-500"
//         >
//           {restaurant?.name || "Restaurant"}
//         </Link>{" "}
//         / <span className="text-gray-700">{dish.title}</span>
//       </nav>

//       <div className="flex flex-col gap-12 lg:flex-row lg:gap-16 max-w-[1280px] mx-auto">
//         <div className="lg:w-[520px]">
//           <div className="rounded-3xl bg-white p-4 shadow-sm">
//             <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-orange-50/60">
//               <img
//                 src={dishImage}
//                 alt={dish.title}
//                 className="h-full w-full object-cover object-center"
//               />
//             </div>
//           </div>
//         </div>

//         <div className="flex-1 space-y-6 rounded-3xl bg-white p-8 shadow-sm">
//           <div className="space-y-3">
//             <h1 className="text-3xl font-bold text-gray-900">{dish.title}</h1>
//             <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
//               {dish.category} · {dish.type}
//             </p>
//             <p className="text-sm text-gray-600">{dish.description}</p>
//           </div>

//           <div className="rounded-2xl bg-orange-50/60 p-4 text-sm text-gray-600">
//             <p>
//               {restaurant?.name} · {restaurant?.distanceKm?.toFixed(1)} km away ·
//               Rated {restaurant?.rating?.toFixed(1)}/5
//             </p>
//             <p>
//               Preparation time:{" "}
//               {dish.preparation
//                 ? `${dish.preparation.prepMinutes} min prep · ${dish.preparation.cookMinutes} min cook`
//                 : "15 – 20 minutes"}
//             </p>
//           </div>

//           {sizeGroup ? (
//             <div className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
//               <div className="flex items-start justify-between gap-4">
//                 <div>
//                   <p className="text-xs font-semibold uppercase text-orange-500">
//                     {sizeGroup.required ? "Size (bắt buộc)" : "Size"}
//                   </p>
//                   <h2 className="text-base font-semibold text-gray-800">
//                     {sizeGroup.name || "Chọn kích cỡ"}
//                   </h2>
//                   {sizeGroup.description ? (
//                     <p className="mt-1 text-xs text-gray-500">
//                       {sizeGroup.description}
//                     </p>
//                   ) : null}
//                 </div>
//                 <span className="text-xs font-semibold uppercase text-gray-400">
//                   {sizeGroup.values?.length} lựa chọn
//                 </span>
//               </div>
//               <div className="grid gap-3 sm:grid-cols-2">
//                 {(sizeGroup.values || []).map((value) => {
//                   const selected = isValueSelected(sizeGroup, value);
//                   const priceText = formatOptionPrice(value.priceDelta);
//                   return (
//                     <button
//                       type="button"
//                       key={value.id || value.label}
//                       onClick={() => handleOptionChange(sizeGroup, value)}
//                       className={`flex flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition ${
//                         selected
//                           ? "border-orange-500 bg-white shadow-sm"
//                           : "border-orange-100 bg-white hover:border-orange-300"
//                       }`}
//                     >
//                       <div className="flex w-full items-center justify-between">
//                         <span className="text-sm font-semibold text-gray-800">
//                           {value.label}
//                         </span>
//                         <span className="text-xs font-semibold text-orange-500">
//                           {priceText}
//                         </span>
//                       </div>
//                       {value.description ? (
//                         <p className="text-xs text-gray-500">
//                           {value.description}
//                         </p>
//                       ) : null}
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>
//           ) : null}

//           {toppingGroup ? (
//             <div className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50/30 p-5">
//               <div className="flex items-start justify-between gap-4">
//                 <div>
//                   <p className="text-xs font-semibold uppercase text-orange-500">
//                     {toppingGroup.maxSelect
//                       ? `${toppingGroup.name || "Topping"} (chọn tối đa ${toppingGroup.maxSelect})`
//                       : toppingGroup.name || "Topping"}
//                   </p>
//                   {toppingGroup.description ? (
//                     <p className="mt-1 text-xs text-gray-500">
//                       {toppingGroup.description}
//                     </p>
//                   ) : null}
//                 </div>
//                 <span className="text-xs font-semibold uppercase text-gray-400">
//                   {toppingGroup.required ? "Bắt buộc" : "Tùy chọn"}
//                 </span>
//               </div>
//               <div className="grid gap-3 md:grid-cols-2">
//                 {(toppingGroup.values || []).map((value) => {
//                   const selected = isValueSelected(toppingGroup, value);
//                   return (
//                     <label
//                       key={value.id || value.label}
//                       className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
//                         selected
//                           ? "border-orange-400 bg-white shadow-sm"
//                           : "border-orange-100 bg-white hover:border-orange-300"
//                       }`}
//                     >
//                       <div className="flex items-center gap-3">
//                         <input
//                           type="checkbox"
//                           checked={selected}
//                           onChange={() => handleOptionChange(toppingGroup, value)}
//                           className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
//                         />
//                         <div className="flex flex-col">
//                           <span className="text-sm font-semibold text-gray-700">
//                             {value.label}
//                           </span>
//                           {value.description ? (
//                             <span className="text-xs text-gray-500">
//                               {value.description}
//                             </span>
//                           ) : null}
//                         </div>
//                       </div>
//                       <span className="text-xs font-semibold text-orange-500">
//                         {formatOptionPrice(value.priceDelta)}
//                       </span>
//                     </label>
//                   );
//                 })}
//               </div>
//             </div>
//           ) : null}

//           {customizableGroups.length ? (
//             <div className="space-y-4">
//               {customizableGroups.map((group) => {
//                 const headerText = (() => {
//                   if (group.required) {
//                     return `${group.name || "Tùy chọn"} (bắt buộc)`;
//                   }
//                   if (group.maxSelect) {
//                     return `${group.name || "Tùy chọn"} (chọn tối đa ${group.maxSelect})`;
//                   }
//                   return group.name || "Tùy chọn";
//                 })();

//                 return (
//                   <div
//                     key={group.id}
//                     className="space-y-4 rounded-2xl border border-orange-100 bg-white p-5"
//                   >
//                     <div className="flex items-start justify-between gap-4">
//                       <div>
//                         <p className="text-xs font-semibold uppercase text-orange-500">
//                           {headerText}
//                         </p>
//                         {group.description ? (
//                           <p className="mt-1 text-xs text-gray-500">
//                             {group.description}
//                           </p>
//                         ) : null}
//                       </div>
//                       {group.minSelect || group.maxSelect ? (
//                         <span className="text-xs font-semibold uppercase text-gray-400">
//                           {group.minSelect
//                             ? `Tối thiểu ${group.minSelect}`
//                             : null}
//                           {group.minSelect && group.maxSelect ? " • " : ""}
//                           {group.maxSelect ? `Tối đa ${group.maxSelect}` : null}
//                         </span>
//                       ) : null}
//                     </div>
//                     {group.type === "single" ? (
//                       <div className="grid gap-3 sm:grid-cols-2">
//                         {(group.values || []).map((value) => {
//                           const selected = isValueSelected(group, value);
//                           return (
//                             <button
//                               type="button"
//                               key={value.id || value.label}
//                               onClick={() => handleOptionChange(group, value)}
//                               className={`flex flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition ${
//                                 selected
//                                   ? "border-orange-500 bg-white shadow-sm"
//                                   : "border-orange-100 bg-white hover:border-orange-300"
//                               }`}
//                             >
//                               <div className="flex w-full items-center justify-between">
//                                 <span className="text-sm font-semibold text-gray-800">
//                                   {value.label}
//                                 </span>
//                                 <span className="text-xs font-semibold text-orange-500">
//                                   {formatOptionPrice(value.priceDelta)}
//                                 </span>
//                               </div>
//                               {value.description ? (
//                                 <p className="text-xs text-gray-500">
//                                   {value.description}
//                                 </p>
//                               ) : null}
//                             </button>
//                           );
//                         })}
//                       </div>
//                     ) : (
//                       <div className="grid gap-3 md:grid-cols-2">
//                         {(group.values || []).map((value) => {
//                           const selected = isValueSelected(group, value);
//                           return (
//                             <label
//                               key={value.id || value.label}
//                               className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
//                                 selected
//                                   ? "border-orange-400 bg-white shadow-sm"
//                                   : "border-orange-100 bg-white hover:border-orange-300"
//                               }`}
//                             >
//                               <div className="flex items-center gap-3">
//                                 <input
//                                   type="checkbox"
//                                   checked={selected}
//                                   onChange={() => handleOptionChange(group, value)}
//                                   className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
//                                 />
//                                 <div className="flex flex-col">
//                                   <span className="text-sm font-semibold text-gray-700">
//                                     {value.label}
//                                   </span>
//                                   {value.description ? (
//                                     <span className="text-xs text-gray-500">
//                                       {value.description}
//                                     </span>
//                                   ) : null}
//                                 </div>
//                               </div>
//                               <span className="text-xs font-semibold text-orange-500">
//                                 {formatOptionPrice(value.priceDelta)}
//                               </span>
//                             </label>
//                           );
//                         })}
//                       </div>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           ) : null}

//           <div className="space-y-4 rounded-3xl bg-orange-50/70 p-6">
//             <div className="flex items-center justify-between">
//               <span className="text-sm font-semibold text-gray-600">
//                 Quantity
//               </span>
//               <div className="flex items-center gap-3 rounded-full border border-orange-200 bg-white px-3 py-1">
//                 <button
//                   type="button"
//                   onClick={() => handleQuantityChange(-1)}
//                   className="h-8 w-8 rounded-full text-lg text-orange-500 transition hover:bg-orange-100"
//                 >
//                   -
//                 </button>
//                 <span className="w-6 text-center text-sm font-semibold text-gray-700">
//                   {quantity}
//                 </span>
//                 <button
//                   type="button"
//                   onClick={() => handleQuantityChange(1)}
//                   className="h-8 w-8 rounded-full text-lg text-orange-500 transition hover:bg-orange-100"
//                 >
//                   +
//                 </button>
//               </div>
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="text-sm font-semibold text-gray-600">
//                 Subtotal
//               </span>
//               <span className="text-sm font-semibold text-gray-700">
//                 {currency}
//                 {subtotalTotal.toLocaleString()}
//               </span>
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="text-sm font-semibold text-gray-600">
//                 VAT ({(taxRate * 100).toFixed(1)}%)
//               </span>
//               <span className="text-sm font-semibold text-gray-700">
//                 {currency}
//                 {taxTotal.toLocaleString()}
//               </span>
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="text-sm font-semibold text-gray-600">
//                 Total
//               </span>
//               <span className="text-2xl font-bold text-orange-500">
//                 {currency}
//                 {totalPrice.toLocaleString()}
//               </span>
//             </div>
//             <p className="text-xs text-gray-400">
//               Unit price (incl. VAT): {currency}
//               {totalPerUnit.toLocaleString()}
//             </p>
//             <button
//               onClick={handleAddToCart}
//               className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
//             >
//               Add to cart
//             </button>
//           </div>
//         </div>
//       </div>

//       <section className="space-y-4">
//         <h2 className="text-xl font-bold text-gray-900">
//           More from {restaurant?.name}
//         </h2>
//         <div className="flex gap-8 overflow-x-auto pb-8 scroll-smooth snap-x snap-mandatory no-scrollbar">
//           {relatedDishes.map((item) => {
//             const fallbackSize = item.sizes?.[0];
//             const base =
//               (fallbackSize && item.price?.[fallbackSize]) ||
//               Object.values(item.price ?? {})[0];
//             const cardImage = pickFirstImageUrl(
//               dishPlaceholderImage,
//               item.images,
//               item.image,
//               item.heroImage,
//             );
//             return (
//               <Link
//                 key={item._id}
//                 to={`/restaurants/${restaurantId}/dishes/${item._id}`}
//                 className="group flex w-[320px] flex-col snap-start flex-shrink-0 overflow-hidden rounded-3xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-lg"
//               >

//                 <div className="relative h-40 overflow-hidden">
//                   <img
//                     src={cardImage}
//                     alt={item.title}
//                     className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105"
//                   />
//                   {item.tags?.[0] ? (
//                     <span className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-500 shadow">
//                       {item.tags[0]}
//                     </span>
//                   ) : null}
//                 </div>
//                 <div className="space-y-2 px-5 py-5">
//                   <h3 className="text-base font-semibold text-gray-900">
//                     {item.title}
//                   </h3>
//                   <p className="text-xs uppercase text-gray-400">
//                     {item.category}
//                   </p>
//                   <p className="text-sm text-gray-500 line-clamp-3">
//                     {item.description}
//                   </p>
//                   <p className="text-sm font-semibold text-orange-500">
//                     From {currency}
//                     {base?.toLocaleString()}
//                   </p>
//                 </div>
//               </Link>
//             );
//           })}
//         </div>
//       </section>
//     </div>
//   );
// };

// export default DishDetail;


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
  const [quantity, setQuantity] = useState(1);

  const formatVnd = (amount) => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) return `0₫`;
    return `${Math.abs(numeric).toLocaleString("vi-VN")}₫`;
  };

  const formatOptionPrice = (amount) => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric === 0) {
      return `(0₫)`;
    }
    const prefix = numeric > 0 ? "+" : "-";
    return `(${prefix}${formatVnd(Math.abs(numeric))})`;
  };

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

  const otherOptionGroups = useMemo(() => {
    if (!sizeGroup) return optionGroups;
    return optionGroups.filter((group) => group.id !== sizeGroup.id);
  }, [optionGroups, sizeGroup]);

  const toppingGroup = useMemo(() => {
    if (!otherOptionGroups.length) return null;
    const explicit = otherOptionGroups.find((group) => {
      if (!group) return false;
      const label = (group.name || "").toLowerCase();
      return (
        group.type === "multiple" &&
        (label.includes("topping") ||
          label.includes("add-on") ||
          label.includes("extra"))
      );
    });
    if (explicit) return explicit;
    if (
      otherOptionGroups.length === 1 &&
      otherOptionGroups[0]?.type === "multiple"
    ) {
      return otherOptionGroups[0];
    }
    return null;
  }, [otherOptionGroups]);

  const customizableGroups = useMemo(() => {
    if (!toppingGroup) return otherOptionGroups;
    return otherOptionGroups.filter((group) => group.id !== toppingGroup.id);
  }, [otherOptionGroups, toppingGroup]);

  const selectedToppingValues = useMemo(() => {
    if (!toppingGroup) return [];
    const values = getSelectedValues(toppingGroup.id);
    return Array.isArray(values) ? values : [];
  }, [toppingGroup, selectionMap]);

  const toppingsPrice = selectedToppingValues.reduce(
    (total, value) => total + (value?.priceDelta || 0),
    0
  );

  const customOptionTotal = customizableGroups.reduce((sum, group) => {
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
    baseUnitPrice + sizePriceDelta + customOptionTotal + toppingsPrice;

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

  const optionSummary = useMemo(() => {
    const summary = [];
    customizableGroups.forEach((group) => {
      const values = getSelectedValues(group.id);
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
    if (toppingGroup && selectedToppingValues.length) {
      summary.push({
        id: toppingGroup.id,
        name: toppingGroup.name || "Toppings",
        values: selectedToppingValues.map((value) => ({
          id: extractOptionId(value),
          label: value.label || value.name,
          priceDelta: value.priceDelta || 0,
        })),
      });
    }
    return summary;
  }, [customizableGroups, selectedToppingValues, toppingGroup, selectionMap]);

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
      optionPriceTotal: customOptionTotal + toppingsPrice,
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
                {sizeGroup.required
                  ? `${sizeGroup.name || "Choose a size"} (bắt buộc)`
                  : sizeGroup.name || "Choose a size"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {(sizeGroup.values || []).map((value) => {
                  const selected = isValueSelected(sizeGroup, value);
                  const priceText =
                    value.priceDelta !== undefined && value.priceDelta !== null
                      ? ` ${formatOptionPrice(value.priceDelta)}`
                      : "";
                  return (
                    <button
                      type="button"
                      key={value.id || value.label}
                      onClick={() => handleOptionChange(sizeGroup, value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        selected
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-orange-100 bg-white text-gray-600 hover:border-orange-300"
                      }`}
                    >
                      {value.label}
                      {priceText}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {toppingGroup ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  {toppingGroup.name || "Add toppings"}
                </h2>
                {toppingGroup.maxSelect ? (
                  <span className="text-xs text-gray-400">
                    Chọn tối đa {toppingGroup.maxSelect}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {(toppingGroup.values || []).map((value) => {
                  const selected = isValueSelected(toppingGroup, value);
                  return (
                    <label
                      key={value.id || value.label}
                      className="flex cursor-pointer items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-gray-600 transition hover:border-orange-300"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleOptionChange(toppingGroup, value)}
                          className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                        />
                        <span>{value.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">
                        {formatOptionPrice(value.priceDelta)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {customizableGroups.length ? (
            <div className="space-y-4">
              {customizableGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-orange-400">
                    {group.name}
                    {group.required ? " *" : ""}
                  </p>
                  {group.type === "single" ? (
                    <div className="flex flex-wrap gap-2">
                      {(group.values || []).map((value) => {
                        const selected = isValueSelected(group, value);
                        const priceText =
                          value.priceDelta !== undefined &&
                          value.priceDelta !== null
                            ? ` ${formatOptionPrice(value.priceDelta)}`
                            : "";
                        return (
                          <button
                            type="button"
                            key={value.id || value.label}
                            onClick={() => handleOptionChange(group, value)}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                              selected
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-orange-100 bg-white text-gray-600 hover:border-orange-300"
                            }`}
                          >
                            {value.label}
                            {priceText}
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
                            <span className="text-[11px] font-semibold text-gray-500">
                              {formatOptionPrice(value.priceDelta)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
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
