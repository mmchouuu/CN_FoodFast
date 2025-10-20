import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  restaurantPlaceholderImage,
  dishPlaceholderImage,
} from "../utils/imageHelpers";

const OrderHistory = () => {
  const {
    activeOrders,
    pastOrders,
    getRestaurantById,
    getDishById,
    currency,
  } =
    useAppContext();

  const sortedOrders = useMemo(
    () =>
      [...activeOrders, ...pastOrders].sort(
        (a, b) =>
          new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      ),
    [activeOrders, pastOrders]
  );

  return (
    <div className="max-padd-container space-y-8 py-24">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">My orders</h1>
        <p className="mt-2 text-sm text-gray-500">
          Review every order you’ve placed, keep an eye on deliveries in
          progress, and revisit your favourites.
        </p>
      </header>

      <div className="space-y-6">
        {sortedOrders.map((order) => {
          const restaurant = getRestaurantById(order.restaurantId);
          const restaurantSnapshot =
            order.restaurantSnapshot || order.metadata?.restaurant_snapshot || {};
          const restaurantDisplayName =
            restaurant?.name ||
            restaurantSnapshot?.name ||
            "Restaurant";
          const restaurantDisplayImage =
            restaurant?.heroImage ||
            (Array.isArray(restaurant?.images) ? restaurant.images[0] : null) ||
            restaurantSnapshot?.heroImage ||
            restaurantSnapshot?.image ||
            restaurantPlaceholderImage;
          return (
            <div
              key={order.id}
              className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <img
                    src={restaurantDisplayImage}
                    alt={restaurantDisplayName}
                    className="h-20 w-20 flex-shrink-0 rounded-3xl object-cover"
                  />
                  <div>
                    <p className="text-sm uppercase text-gray-400">
                      {new Date(order.placedAt).toLocaleDateString()} -{" "}
                      {order.paymentMethod}
                    </p>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {restaurantDisplayName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Order #{order.id} • {order.status}
                      {order.paymentStatus ? (
                        <span className="ml-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          Payment: {order.paymentStatus}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="text-right">
                    <p className="text-xs uppercase text-gray-400">Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {currency}
                      {order.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      to={`/orders/${order.id}`}
                      className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-500"
                    >
                      View details
                    </Link>
                    <Link
                      to={`/restaurants/${order.restaurantId}`}
                      className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-500"
                    >
                      Order again
                    </Link>
                    {order.canReview ? (
                      <Link
                        to={`/reviews?orderId=${order.id}`}
                        className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                      >
                        Leave review
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {order.items.map((item, index) => {
                  const dish = getDishById(item.dishId);
                  const snapshot = item.productSnapshot || {};
                  const dishTitle =
                    dish?.title ||
                    snapshot.title ||
                    snapshot.name ||
                    item.displayName ||
                    item.dishId;
                  const dishImage =
                    (Array.isArray(dish?.images) ? dish.images[0] : null) ||
                    snapshot.image ||
                    (Array.isArray(snapshot.images) ? snapshot.images[0] : null) ||
                    item.displayImage ||
                    dishPlaceholderImage;
                  return (
                    <div
                      key={`${item.dishId}-${index}`}
                      className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={dishImage}
                          alt={dishTitle}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.quantity} x {dishTitle}
                          </p>
                          <p className="text-xs text-gray-500">
                            Size: {item.size}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-gray-900">
                        {currency}
                        {item.price.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!sortedOrders.length && (
        <div className="rounded-3xl bg-white p-10 text-center text-gray-500 shadow">
          You have not placed any orders yet. Explore restaurants to get
          started.
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
