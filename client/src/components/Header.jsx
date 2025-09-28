// import React, { useState } from 'react';
// import { Link, useLocation } from 'react-router-dom';
// import { assets } from '../assets/data';
// import { useAppContext } from '../context/AppContext';
// import Navbar from './navbar';
// import { useClerk, UserButton } from "@clerk/clerk-react";
// import { AiOutlineFileText } from "react-icons/ai";
// import { useAuth0 } from "@auth0/auth0-react";


// const Header = () => {
//   const [menuOpened, setMenuOpened] = useState(false);
//   const location = useLocation(); // Lấy path hiện tại
//   const { navigate, user, getCartCount } = useAppContext() || {};
//   const { openSignIn } = useClerk();

//   const isHomePage = useLocation().pathname.endsWith('/')

//   const toggleMenu = () => setMenuOpened(prev => !prev);
//   const OrdersIcon = () => <AiOutlineFileText className="w-4 h-4" />;

//   // Kiểm tra menu đang active
//   const isActive = (path) => location.pathname === path;

//   const menuItems = [
//     { name: "Home", path: "/" },
//     { name: "Menu", path: "/menu" },
//     { name: "Blog", path: "/blog" },
//     { name: "Contact", path: "/contact" },
//   ];

//   return (
//     <header className={`absolute top-0 left-0 right-0 z-50 py-3 ${!isHomePage && "bg-white"}`}>
//       <div className="max-padd-container flex items-center justify-between">
//         {/* LOGO */}

//         <Link to="/" className="flex items-center gap-2">
//           <img src={assets.logoImg} alt="logo" className="h-12 w-12" />
//           <div className="flex flex-col">
//             <span className="hidden sm:block font-extrabold text-3xl relative top-1 left-1">
//               Tasty
//             </span>
//             <span
//               className="hidden sm:block font-extrabold text-xs relative left-1.5 tracking-[10px] uppercase text-orange-500"
//             >
//               Queen
//             </span>
//           </div>
//         </Link>

//         {/* NAVBAR */}
//         <nav className="hidden lg:flex flex-1 justify-center gap-x-8 text-lg font-medium">
//           {menuItems.map(item => (
//             <Link
//               key={item.path}
//               to={item.path}
//               className={isActive(item.path) ? "text-orange-500" : ""}
//             >
//               {item.name}
//             </Link>
//           ))}
//         </nav>

//         {/* BUTTONS & MENU TOGGLE */}
//         <div className="flex items-center gap-4 lg:gap-8">
//           {/* MENU TOGGLE mobile */}
//           <div className="relative lg:hidden w-7 h-6" onClick={toggleMenu}>
//             <img
//               src={menuOpened ? assets.menuClose : assets.menu}
//               alt="menu toggle"
//               className="cursor-pointer w-full h-full"
//             />
//           </div>

//           {/* MENU TOGGLE */}
//           {menuOpened && (
//             <div className="absolute top-16 right-6 w-40 bg-white shadow-md rounded-lg flex flex-col gap-4 p-4 z-50">
//               {menuItems.map(item => (
//                 <Link
//                   key={item.path}
//                   to={item.path}
//                   className={isActive(item.path) ? "text-orange-500" : ""}
//                   onClick={() => setMenuOpened(false)}
//                 >
//                   {item.name}
//                 </Link>
//               ))}
//             </div>
//           )}

//         {/* CART */}
//         <div onClick={() => navigate('/cart')} className="relative cursor-pointer">
//           <img src={assets.cartAdded} alt="cart" className="p-2 rounded-full" />
//           <span
//             className="absolute -top-2 -right-2 w-5 h-5 text-xs font-bold flex items-center justify-center rounded-full text-white"
//             style={{ backgroundColor: "#dc583e" }}
//           >
//             {getCartCount()}
//           </span>
//         </div>


//         {/* USER PROFILE */}
//         <div>
//           {user ? (
//             <UserButton
//               appearance={{
//                 elements: {
//                   userButtonAvatarBox: {
//                     width: "42px",
//                     height: "42px",
//                   },
//                 },
//               }}
//             >
//               <UserButton.MenuItems>
//                 <UserButton.Action
//                   label="My Orders"
//                   labelIcon={<OrdersIcon />}
//                   onClick={() => navigate("/my-orders")}
//                 />
//               </UserButton.MenuItems>
//             </UserButton>


//           ) : (
//             <button
//               className="btn-solid flex items-center gap-2"
//               onClick={() => openSignIn()}
//             >
//               Login
//               <img src={assets.user} alt="user" className="w-5 invert" />
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//     </header >
//   );
// };

// export default Header;


import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { assets } from '../assets/data';
import { useAppContext } from '../context/AppContext';
import { useAuth0 } from '@auth0/auth0-react';
import { AiOutlineFileText } from "react-icons/ai";
import AuthForm from '../pages/AuthForm';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCartCount } = useAppContext();
  const { user, isAuthenticated, loginWithRedirect, logout } = useAuth0();

  const [menuOpened, setMenuOpened] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const isHomePage = location.pathname === '/';

  const menuItems = [
    { name: "Home", path: "/" },
    { name: "Menu", path: "/menu" },
    { name: "Blog", path: "/blog" },
    { name: "Contact", path: "/contact" },
  ];

  const toggleMenu = () => setMenuOpened(prev => !prev);
  const OrdersIcon = () => <AiOutlineFileText className="w-4 h-4" />;

  const isActive = (path) => location.pathname === path;

  return (
    <header className={`absolute top-0 left-0 right-0 z-50 py-3 ${!isHomePage && "bg-white"}`}>
      <div className="max-padd-container flex items-center justify-between">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2">
          <img src={assets.logoImg} alt="logo" className="h-12 w-12" />
          <div className="flex flex-col">
            <span className="hidden sm:block font-extrabold text-3xl relative top-1 left-1">Tasty</span>
            <span className="hidden sm:block font-extrabold text-xs relative left-1.5 tracking-[10px] uppercase text-orange-500">Queen</span>
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
            <img src={menuOpened ? assets.menuClose : assets.menu} alt="menu toggle" className="cursor-pointer w-full h-full" />
          </div>

          {/* MENU TOGGLE mobile */}
          {menuOpened && (
            <div className="absolute top-16 right-6 w-40 bg-white shadow-md rounded-lg flex flex-col gap-4 p-4 z-50">
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

          {/* CART */}
          <div onClick={() => navigate('/cart')} className="relative cursor-pointer">
            <img src={assets.cartAdded} alt="cart" className="p-2 rounded-full" />
            <span
              className="absolute -top-2 -right-2 w-5 h-5 text-xs font-bold flex items-center justify-center rounded-full text-white"
              style={{ backgroundColor: "#dc583e" }}
            >
              {getCartCount()}
            </span>
          </div>
          {/* USER PROFILE */}
          <div className="relative">
            {isAuthenticated && user ? (
              <div>
                <img
                  src={user.picture || assets.user}
                  alt="avatar"
                  className="w-10 h-10 rounded-full cursor-pointer"
                  onClick={() => setShowDropdown(prev => !prev)}
                />
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-44 bg-white shadow-md rounded-lg flex flex-col p-2 z-50">
                    <button
                      className="text-left px-2 py-1 hover:bg-gray-100"
                      onClick={() => { navigate("/my-orders"); setShowDropdown(false); }}
                    >
                      My Orders
                    </button>
                    <button
                      className="text-left px-2 py-1 hover:bg-gray-100"
                      onClick={() => { navigate("/profile"); setShowDropdown(false); }}
                    >
                      Manage Profile
                    </button>
                    <button
                      className="text-left px-2 py-1 hover:bg-red-100 text-red-500"
                      onClick={() => logout({ returnTo: window.location.origin })}
                    >
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="btn-solid" onClick={() => setShowLogin(true)}>Login</button>
                {showLogin && (
                  <AuthForm
                    onClose={() => setShowLogin(false)}
                    onSignup={(data) => console.log("signup", data)}
                    onForgot={(data) => console.log("forgot", data)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;