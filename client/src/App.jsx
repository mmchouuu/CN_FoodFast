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
//         <Route path='/owner' element={<Sidebar />}>
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


import React from 'react';
import { Route, Routes, useLocation } from "react-router-dom";
import Home from './pages/Home';
import Menu from './pages/Menu';
import MenuPage from './pages/MenuPage';
import Blog from './pages/Blog';
import Contact from './pages/Contact';
import Cart from './pages/Cart';
import AddressForm from './pages/AddressForm';
import MyOrders from './pages/MyOrders';
import Header from './components/Header';
import Footer from './components/Footer';
import { Toaster } from "react-hot-toast";
import Orders from './pages/owner/orders';
import AddProduct from './pages/owner/AddProduct';
import ListProduct from './pages/owner/ListProduct';
import Sidebar from './components/owner/Sidebar';
import Statistics from './pages/owner/Statistics';
import UserAccounts from './pages/owner/UserAccounts';
import AdminAccounts from './pages/owner/AdminAccounts';

const App = () => {
  const isOwnerPath = useLocation().pathname.includes('owner');

  return (
    <main className="overflow-x-hidden text-textColor">
      {!isOwnerPath && <Header />}
      <Toaster position="bottom-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/menu/:restaurantId" element={<MenuPage />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/address-form" element={<AddressForm />} />
        <Route path="/my-orders" element={<MyOrders />} />

        {/* Owner routes */}
        <Route path="/owner" element={<Sidebar />}>
          <Route index element={<Statistics />} />
          <Route path="/owner/add-product" element={<AddProduct />} />
          <Route path="/owner/list-product" element={<ListProduct />} />
          <Route path="/owner/orders" element={<Orders />} />
          <Route path="/owner/users" element={<UserAccounts />} />
          <Route path="/owner/admins" element={<AdminAccounts />} />
        </Route>
      </Routes>
      {!isOwnerPath && <Footer />}
    </main>
  );
};
export default App;
