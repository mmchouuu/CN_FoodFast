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
import { Toaster } from "react-hot-toast"
import Dashboard from './pages/owner/Dashboard'
import AddProduct from './pages/owner/AddProduct'
import ListProduct from './pages/owner/ListProduct'
import Sidebar from './components/owner/Sidebar'
import { useAppContext } from './context/AppContext'

const App = () => {
  const {isOwner} = useAppContext()

  return (
    <main className='overflow-x-hidden text-textColor'>
      {!isOwner && <Header />} 
      <Toaster position='bottom-right' />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/menu' element={<Menu />} />
        <Route path='/blog' element={<Blog />} />
        <Route path='/contact' element={<Contact />} />
        <Route path='/cart' element={<Cart />} />
        <Route path='/address-form' element={<AddressForm />} />
        <Route path='/my-orders' element={<MyOrders />} />
        {/* Owner routes */}
        <Route path='/owner' element={<Sidebar />}>
          <Route index element={<Dashboard />} />
          <Route path='/owner/add-product' element={<AddProduct />} />
          <Route path='/owner/list-product' element={<ListProduct />} />

        </Route>
      </Routes>
      {!isOwner && <Footer />}
    </main>
  )
}

export default App
