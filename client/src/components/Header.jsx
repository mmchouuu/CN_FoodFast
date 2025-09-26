import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { assets } from '../assets/data';

const Header = () => {
  const [menuOpened, setMenuOpened] = useState(false);
  const location = useLocation(); // Lấy path hiện tại

  const toggleMenu = () => setMenuOpened(prev => !prev);

  // Kiểm tra menu đang active
  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { name: "Home", path: "/" },
    { name: "Menu", path: "/menu" },
    { name: "Blog", path: "/blog" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <header className="absolute top-0 left-0 right-0 z-50 py-3">
      <div className="max-padd-container flex items-center justify-between">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2">
          <img src={assets.logoImg} alt="logo" className="h-12 w-12" />
          <div className="flex flex-col">
            <span className="hidden sm:block font-extrabold text-3xl relative top-1 left-1">Tasty</span>
            <span
              className="hidden sm:block font-extrabold text-xs relative left-1.5 tracking-[10px] uppercase"
              style={{ color: "#dc583e" }}
            >
              KING
            </span>
          </div>
        </Link>

        {/* NAVBAR */}
        <nav className="hidden lg:flex flex-1 justify-center gap-x-8 text-lg font-medium">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={isActive(item.path) ? "text-orange-500" : ""}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* BUTTONS & MENU TOGGLE */}
        <div className="flex items-center gap-4 lg:gap-8">
          {/* MENU TOGGLE mobile */}
          <div className="relative lg:hidden w-7 h-6" onClick={toggleMenu}>
            <img
              src={menuOpened ? assets.menuClose : assets.menu}
              alt="menu toggle"
              className="cursor-pointer w-full h-full"
            />
          </div>

          {/* MENU TOGGLE */}
          {menuOpened && (
            <div className="absolute top-16 right-6 w-40 shadow-md rounded-lg flex flex-col gap-4 p-4 z-50">
              {menuItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={isActive(item.path) ? "text-orange-500" : ""}
                  onClick={() => setMenuOpened(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          )}

          {/* CART  */}
          <div className="relative">
            <img src={assets.cartAdded} alt="cart" className="p-2 rounded-full" />
            <span
              className="absolute -top-2 -right-2 w-5 h-5 text-xs font-bold flex items-center justify-center rounded-full text-white"
              style={{ backgroundColor: "#dc583e" }}
            >
              0
            </span>
          </div>

          {/* LOGIN */}
          <button className="btn-solid flex items-center gap-2">
            Login
            <img src={assets.user} alt="user" className="w-5 invert" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
