import { useAppContext } from '../context/AppContext'
import React, { useState, useEffect } from 'react';
import CartTotal from '../components/CartTotal';
import Title from '../components/Title'

const AddressForm = () => {
  const { navigate, user } = useAppContext()
  const [address, setAddress] = useState({
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    ward: "",
    district: "",
    city: "",
    phone: "",

  })

  const onChangeHandler = (e) => {
    const name = e.target.name
    const value = e.target.value

    setAddress((data) => ({ ...data, [name]: value }))
  }

  useEffect(() => {
    if (!user) {
      navigate('/cart')
    }
  }, [user, navigate])

  return (
    <div className='max-padd-container py-16 pt-28 bg-primary'>
      {/* CONTAINER */}
      <div className='flex flex-col xl:flex-row gap-28 xl:gap-28'>
        {/* Left Side */}
        <form className='flex flex-[2] flex-col gap-3 text-[95%]'>
          <Title title1={"Delivery "} title2={"Information"} titleStyles={"pb-5"} />
          <div className='flex gap-3'>
            <input conChange={onChangeHandler} value={address.firstName} 
            name='firstName' type="text" placeholder='First Name' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none w-1/2'/>
            <input conChange={onChangeHandler} value={address.lastName} 
            name='lastName' type="text" placeholder='Last Name' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none w-1/2'/>
          </div>

          <div className='flex gap-3'>
            <input conChange={onChangeHandler} value={address.email} 
            name='email' type="email" placeholder='Email' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none w-1/2'/>
            <input conChange={onChangeHandler} value={address.phone} 
            name='phone' type="text" placeholder='Phone' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none w-1/2'/>
          </div>

          <input conChange={onChangeHandler} value={address.street} 
            name='street' type="text" placeholder='Street' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none'/>

          <div className='flex gap-3'>
            <input conChange={onChangeHandler} value={address.firstName} 
            name='ward' type="text" placeholder='Ward' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none w-1/2'/>
            <input conChange={onChangeHandler} value={address.lastName} 
            name='district' type="text" placeholder='District' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none w-1/2'/>
          </div>

          <input conChange={onChangeHandler} value={address.street} 
            name='city' type="text" placeholder='City' 
            className='ring-1 ring-slate-900/15 p-1 pl-3 rounded-sm bg-white
            outlinr-none'/>
          <button type='submit' className='btn-solid rounded-md w-1/2 mt-2'>Add Address</button>
        </form>
        {/* Right Side */}
        <div className='flex flex-1 flex-col'>
          <div className='max-w-[379px] w-full bg-white p-5 py-10 max-md:mt-16 rounded-xl'>
            <CartTotal />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddressForm

