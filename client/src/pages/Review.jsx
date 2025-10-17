import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const ratingLevels = [1, 2, 3, 4, 5];

const Review = () => {
  const { pastOrders, getRestaurantById, getDishById } = useAppContext();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  const order = useMemo(
    () => pastOrders.find((item) => item.id === orderId) || pastOrders[0],
    [pastOrders, orderId]
  );

  const restaurant = order ? getRestaurantById(order.restaurantId) : null;

  const [restaurantRating, setRestaurantRating] = useState(5);
  const [dishRatings, setDishRatings] = useState(
    () =>
      order?.items.reduce((acc, item) => {
        acc[item.dishId] = 5;
        return acc;
      }, {}) || {}
  );
  const [riderRating, setRiderRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  if (!order) {
    return (
      <div className="max-padd-container py-24 text-center">
        <h1 className="text-3xl font-bold text-gray-900">No order to review</h1>
        <p className="mt-2 text-gray-500">
          Place an order to share your experience with the community.
        </p>
      </div>
    );
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    toast.success("Thank you for your feedback!");
    setFeedback("");
  };

  return (
    <div className="max-padd-container space-y-8 py-24">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Share your review</h1>
        <p className="mt-2 text-sm text-gray-500">
          Tell us how your order from {restaurant?.name} went. Your feedback
          helps improve the experience for everyone.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-3xl bg-white p-8 shadow-sm"
      >
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Restaurant experience
          </h2>
          <div className="flex items-center gap-3">
            {ratingLevels.map((level) => (
              <button
                type="button"
                key={level}
                onClick={() => setRestaurantRating(level)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                  restaurantRating >= level
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Rate your dishes
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {order.items.map((item) => {
              const dish = getDishById(item.dishId);
              return (
                <div
                  key={item.dishId}
                  className="rounded-2xl border border-gray-200 p-5 text-sm text-gray-600"
                >
                  <p className="text-base font-semibold text-gray-900">
                    {dish?.title || item.dishId}
                  </p>
                  <p className="text-xs text-gray-400">Size: {item.size}</p>
                  <div className="mt-3 flex items-center gap-2">
                    {ratingLevels.map((level) => (
                      <button
                        type="button"
                        key={`${item.dishId}-${level}`}
                        onClick={() =>
                          setDishRatings((prev) => ({
                            ...prev,
                            [item.dishId]: level,
                          }))
                        }
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition ${
                          dishRatings[item.dishId] >= level
                            ? "bg-orange-400 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Delivery experience
          </h2>
          <div className="flex items-center gap-3">
            {ratingLevels.map((level) => (
              <button
                type="button"
                key={`rider-${level}`}
                onClick={() => setRiderRating(level)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                  riderRating >= level
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Comments</h2>
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={4}
            placeholder="Share any details about the food quality, packaging, delivery speed..."
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </section>

        <button
          type="submit"
          className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Submit review
        </button>
      </form>
    </div>
  );
};

export default Review;
