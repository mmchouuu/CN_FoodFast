import React, { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";

const Notifications = () => {
  const { notifications, markNotificationAsRead } = useAppContext();
  const [filter, setFilter] = useState("all");

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((item) => !item.read);
    return notifications.filter((item) => item.type === filter);
  }, [notifications, filter]);

  return (
    <div className="max-padd-container space-y-8 py-24">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">
            Stay updated with promotions, order progress, and account changes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["all", "unread", "promotion", "order", "system"].map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                filter === option
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-4">
        {filteredNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-3xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
              notification.read
                ? "border-gray-200 bg-white"
                : "border-orange-300 bg-orange-50"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase text-gray-400">
                  {notification.type}
                </p>
                <h2 className="text-lg font-semibold text-gray-900">
                  {notification.title}
                </h2>
                <p className="text-sm text-gray-600">{notification.message}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-gray-400">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
                {!notification.read ? (
                  <button
                    onClick={() => markNotificationAsRead(notification.id)}
                    className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                  >
                    Mark as read
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {!filteredNotifications.length && (
          <div className="rounded-3xl bg-white p-10 text-center text-gray-500 shadow">
            No notifications to show for this filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
