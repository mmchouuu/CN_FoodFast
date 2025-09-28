import React from 'react'
import { Route, Routes } from "react-router-dom"
import Home from './pages/Home'
import Menu from './pages/Menu'
import Blog from './pages/Blog'
import Contact from './pages/Contact'
import Cart from './pages/Cart'
import AddressForm from './pages/AddressForm'
import MyOrders from './pages/MyOrders'
import Header from './components/Header'
import Footer from './components/Footer'
import {Toaster} from "react-hot-toast"
import AccountPage from "./pages/AuthForm";
import PaymentSettings from "./pages/PaymentSettings";


const App = () => {
  return (
    <main className='overflow-x-hidden text-textColor'>
      <Header/>
      <Toaster position='bottom-right' />
      <Routes>
        <Route path='/' element={<Home />}/>
        <Route path='/menu' element={<Menu />}/>
        <Route path='/blog' element={<Blog />}/>
        <Route path='/contact' element={<Contact />}/>
        <Route path='/cart' element={<Cart />}/>
        <Route path='/address-form' element={<AddressForm />}/>
        <Route path='/my-orders' element={<MyOrders />}/>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/payment" element={<PaymentSettings />} />
      </Routes>
      <Footer/>
    </main>
  )
}

export default App
