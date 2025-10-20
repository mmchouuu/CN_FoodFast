import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CustomerProfilePanel from "./CustomerProfilePanel";
import { assets } from "../assets/data";
import { useAppContext } from "../context/AppContext";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Restaurants", href: "/restaurants" },
  { label: "My Orders", href: "/orders/current" },
];

const BellIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M14.857 17.657a2 2 0 11-3.714 0M6.5 9a5.5 5.5 0 1111 0c0 3.11.964 4.652 1.295 5.152a.75.75 0 01-.633 1.165H5.838a.75.75 0 01-.633-1.165C5.536 13.652 6.5 12.11 6.5 9z"
    />
  </svg>
);

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    getCartCount,
    isAuthenticated,
    logoutAuth0,
    logoutLocal,
    searchQuery,
    setSearchQuery,
    notifications,
    user,
  } = useAppContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const isActive = (href) =>
    href === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(href);

  const cartCount = getCartCount();

  const initials = useMemo(() => {
    const fullName =
      user?.fullName ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      user?.name ||
      "";
    if (!fullName) return "F";
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0).toUpperCase() +
      parts[parts.length - 1].charAt(0).toUpperCase()
    );
  }, [user]);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 shadow-sm backdrop-blur">
        <div className="max-padd-container flex items-center gap-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={assets.logoImg}
              alt="FoodFast logo"
              className="h-12 w-12"
            />
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-orange-500">
                Tasty
              </p>
              <p className="text-xl font-bold text-gray-900">
                Queen
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 text-sm font-semibold text-gray-700 lg:flex">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`rounded-full px-4 py-2 transition ${
                  isActive(item.href)
                    ? "bg-orange-500 text-white shadow"
                    : "hover:bg-orange-50 hover:text-orange-500"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
              <div className="relative flex w-full max-w-md items-center rounded-full border border-orange-100 bg-white px-4 py-2 text-sm shadow">
                <img
                  src={assets.search}
                  alt="Search"
                  className="mr-2 h-4 w-4"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search restaurants, dishes or addresses..."
                  className="w-full border-none bg-transparent text-sm text-gray-700 outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => navigate("/notifications")}
              className="relative hidden rounded-full border border-gray-200 p-2 text-gray-600 transition hover:border-orange-300 hover:text-orange-500 md:flex"
              aria-label="Notifications"
            >
              <BellIcon className="h-5 w-5" />
              {unreadNotifications ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => navigate("/cart")}
              className="relative rounded-full border border-orange-100 p-2 text-gray-600 transition hover:border-orange-300 hover:text-orange-500"
              aria-label="View cart"
            >
              <img
                src={assets.cartAdd}
                alt="Cart"
                className="h-5 w-5 invert"
              />
              {cartCount ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              ) : null}
            </button>

            {isAuthenticated ? (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  onClick={() => setProfileOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600"
                  aria-label="Open profile"
                >
                  {initials}
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/auth/login")}
                className="hidden rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 md:block"
              >
                Log in
              </button>
            )}

            <button
              onClick={() => navigate("/restaurant/auth/register")}
              className="hidden rounded-full border border-orange-200 px-5 py-2 text-sm font-semibold text-orange-500 transition hover:border-orange-300 hover:bg-orange-50 md:block"
            >
              For Restaurants
            </button>

            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="rounded-full border border-gray-200 p-2 hover:border-orange-300 md:hidden"
              aria-label="Toggle navigation"
            >
              <img
                src={menuOpen ? assets.menuClose : assets.menu}
                alt="Toggle menu"
                className="h-5 w-5"
              />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-gray-100 bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-semibold text-gray-700">
              <div className="relative flex items-center rounded-full border border-orange-100 bg-white px-4 py-2 text-sm shadow">
                <img
                  src={assets.search}
                  alt="Search"
                  className="mr-2 h-4 w-4"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search restaurants, dishes or addresses..."
                  className="w-full border-none bg-transparent text-sm text-gray-700 outline-none"
                />
              </div>
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-2xl px-4 py-3 transition ${
                    isActive(item.href)
                      ? "bg-orange-500 text-white"
                      : "hover:bg-orange-50 hover:text-orange-500"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/notifications"
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl px-4 py-3 text-left text-gray-700 transition hover:bg-orange-50 hover:text-orange-500"
              >
                Notifications
                {unreadNotifications ? (
                  <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-semibold text-white">
                    {unreadNotifications}
                  </span>
                ) : null}
              </Link>
              <button
                onClick={() => {
                  navigate("/restaurant/auth/register");
                  setMenuOpen(false);
                }}
                className="rounded-2xl border border-orange-200 px-4 py-3 text-left text-orange-500 transition hover:border-orange-300 hover:bg-orange-50"
              >
                For Restaurants
              </button>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => {
                      setProfileOpen(true);
                      setMenuOpen(false);
                    }}
                    className="rounded-2xl border border-orange-100 px-4 py-3 text-left text-gray-700 transition hover:border-orange-300 hover:text-orange-500"
                  >
                    Customer profile
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    navigate("/auth/login");
                    setMenuOpen(false);
                  }}
                  className="rounded-2xl bg-orange-500 px-4 py-3 text-left text-white"
                >
                  Log in
                </button>
              )}
            </div>
          </div>
        ) : null}
      </header>

      {isAuthenticated ? (
        <CustomerProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onLogout={() => {
            logoutLocal?.();
            if (logoutAuth0) {
              try {
                logoutAuth0({ returnTo: window.location.origin });
              } catch (error) {
                console.warn('Auth0 logout skipped:', error);
              }
            }
          }}
        />
      ) : null}
    </>
  );
};

export default Header;
