import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const OrderHistory = () => {
  const { pastOrders, getRestaurantById, getDishById, currency } =
    useAppContext();

  const sortedOrders = useMemo(
    () =>
      [...pastOrders].sort(
        (a, b) =>
          new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      ),
    [pastOrders]
  );

  return (
    <div className="max-padd-container space-y-8 py-24">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Order history</h1>
        <p className="mt-2 text-sm text-gray-500">
          Track previous orders, view receipts, and share feedback with
          restaurants and riders.
        </p>
      </header>

      <div className="space-y-6">
        {sortedOrders.map((order) => {
          const restaurant = getRestaurantById(order.restaurantId);
          return (
            <div
              key={order.id}
              className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase text-gray-400">
                    {new Date(order.placedAt).toLocaleDateString()} -{" "}
                    {order.paymentMethod}
                  </p>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {restaurant?.name || "Restaurant"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Order #{order.id} - {order.status}
                  </p>
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
                  return (
                    <div
                      key={`${item.dishId}-${index}`}
                      className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600"
                    >
                      <p className="font-semibold text-gray-900">
                        {item.quantity} x {dish?.title || item.dishId}
                      </p>
                      <p className="text-xs text-gray-500">
                        Size: {item.size}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
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
