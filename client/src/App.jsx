// import React from 'react'
// import { Route, Routes, useLocation } from "react-router-dom"
// import Home from './pages/Home'
// import Menu from './pages/Menu'
// import Blog from './pages/Blog'
// import Contact from './pages/Contact'
// import Cart from './pages/Cart'
// import AddressForm from './pages/AddressForm'
// import MyOrders from './pages/MyOrders'
// import Header from './components/Header'
// import Footer from './components/Footer'
// import { Toaster } from "react-hot-toast"
// import Orders from './pages/owner/orders'
// import AddProduct from './pages/owner/AddProduct'
// import ListProduct from './pages/owner/ListProduct'
// import Sidebar from './components/owner/Sidebar'
// import { useAppContext } from './context/AppContext'
// import Statistics from './pages/owner/Statistics'
// import UserAccounts from './pages/owner/UserAccounts'
// import AdminAccounts from './pages/owner/AdminAccounts'

// const App = () => {
//   const isOwnerPath = useLocation().pathname.includes('owner')
//   // const isOwner = useAppContext()

//   return (
//     <main className='overflow-x-hidden text-textColor'>
//       {!isOwnerPath && <Header />} 
//       {/* {!isOwner && <Header />}  */}
//       <Toaster position='bottom-right' />
//       <Routes>
//         <Route path='/' element={<Home />} />
//         <Route path='/menu' element={<Menu />} />
//         <Route path='/blog' element={<Blog />} />
//         <Route path='/contact' element={<Contact />} />
//         <Route path='/cart' element={<Cart />} />
//         <Route path='/address-form' element={<AddressForm />} />
//         <Route path='/my-orders' element={<MyOrders />} />
//         Owner routes
//         <Route path='/owner' element={<OwnerLayout />}>
//           <Route index element={<Statistics />} />
//           <Route path='/owner/add-product' element={<AddProduct />} />
//           <Route path='/owner/list-product' element={<ListProduct />} />
//           <Route path='/owner/orders' element={<Orders />} />
//           <Route path='/owner/users' element={<UserAccounts />} />
//           <Route path='/owner/admins' element={<AdminAccounts />} />
//         </Route>
//       </Routes>
//       {!isOwnerPath && <Footer />}
//     </main>
//   )
// }

// export default App


import React, { useMemo } from 'react';
import { Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Header from './components/Header';
import Footer from './components/Footer';

// Customer pages
import Home from './pages/Home';
import Restaurants from './pages/Restaurants';
import RestaurantDetail from './pages/RestaurantDetail';
import DishDetail from './pages/DishDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Account from './pages/Account';
import CurrentOrder from './pages/CurrentOrder';
import OrderHistory from './pages/MyOrders';
import Review from './pages/Review';
import Notifications from './pages/Notifications';
import Blog from './pages/Blog';
import Contact from './pages/Contact';
import AddressForm from './pages/AddressForm';
import AuthPage from './pages/Auth';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import Verify from './pages/auth/Verify';
import AddAddress from './pages/auth/AddAddress';
import Settings from './pages/Settings';

// Restaurant auth pages
import RestaurantRegister from './pages/restaurant/RestaurantRegister';
import RestaurantVerify from './pages/restaurant/RestaurantVerify';
import RestaurantLogin from './pages/restaurant/RestaurantLogin';

// Owner pages
import OwnerLayout from './layouts/OwnerLayout';
import OwnerDashboard from './pages/owner/Dashboard';
import MenuManagement from './pages/owner/MenuManagement';
import Orders from './pages/owner/Orders';
import ShipperManagement from './pages/owner/ShipperManagement';
import AssignOrders from './pages/owner/AssignOrders';
import DeliveryTracking from './pages/owner/DeliveryTracking';
import RestaurantProfile from './pages/owner/RestaurantProfile';
import Promotions from './pages/owner/Promotions';
import CustomerFeedback from './pages/owner/CustomerFeedback';
import RevenueStatistics from './pages/owner/RevenueStatistics';
import AccountManagement from './pages/owner/AccountManagement';
import EnableOwner from './pages/owner/EnableOwner';

// Admin pages
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminRestaurants from './pages/admin/AdminRestaurants';
import AdminAuthorization from './pages/admin/AdminAuthorization';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminActivity from './pages/admin/AdminActivity';

const App = () => {
  const { pathname } = useLocation();
  const isOwnerPath = useMemo(() => pathname.startsWith('/owner'), [pathname]);
  const isAdminPath = useMemo(() => pathname.startsWith('/admin'), [pathname]);

  return (
    <main className="overflow-x-hidden text-textColor">
      {(!isOwnerPath && !isAdminPath) && <Header />}
      <Toaster position="bottom-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/restaurants" element={<Restaurants />} />
        {/* Legacy menu path support */}
        <Route path="/menu" element={<Restaurants />} />
        <Route path="/restaurants/:restaurantId" element={<RestaurantDetail />} />
        <Route path="/restaurants/:restaurantId/dishes/:dishId" element={<DishDetail />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/address-form" element={<AddressForm />} />
        <Route path="/account" element={<Account />} />
        <Route path="/orders/current" element={<CurrentOrder />} />
        <Route path="/orders/history" element={<OrderHistory />} />
        <Route path="/reviews" element={<Review />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<Signup />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/verify" element={<Verify />} />
        <Route path="/auth/add-address" element={<AddAddress />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/restaurant/auth/register" element={<RestaurantRegister />} />
        <Route path="/restaurant/auth/verify" element={<RestaurantVerify />} />
        <Route path="/restaurant/auth/login" element={<RestaurantLogin />} />
        {/* Dev helper to enable owner mode */}
        <Route path="/owner/enable" element={<EnableOwner />} />

        {/* Owner routes */}
        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<OwnerDashboard />} />
          <Route path="menu" element={<MenuManagement />} />
          <Route path="orders" element={<Orders />} />
          <Route path="shippers" element={<ShipperManagement />} />
          <Route path="assignments" element={<AssignOrders />} />
          <Route path="tracking" element={<DeliveryTracking />} />
          <Route path="profile" element={<RestaurantProfile />} />
          <Route path="promotions" element={<Promotions />} />
          <Route path="feedback" element={<CustomerFeedback />} />
          <Route path="revenue" element={<RevenueStatistics />} />
          <Route path="account" element={<AccountManagement />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="restaurants" element={<AdminRestaurants />} />
          <Route path="authorization" element={<AdminAuthorization />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="promotions" element={<AdminPromotions />} />
          <Route path="activity" element={<AdminActivity />} />
        </Route>
      </Routes>
      {(!isOwnerPath && !isAdminPath) && <Footer />}
    </main>
  );
};
export default App;


