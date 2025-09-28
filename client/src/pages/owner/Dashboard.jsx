import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { assets, dummyDashboardData } from '../../assets/data'


const Dashboard = () => {
  const {user, currency} = useAppContext()
  const [dashboardData, setDashboardData] = useState({
    orders: [],
    totalOrders: 0,
    totalRevenue: 0,
  })

  const getDashboardData = ()=> {
    setDashboardData(dummyDashboardData)
  }

  useEffect(()=>{
    if(user){
      getDashboardData()
    }
  }, [user])

  return (
    <div className="md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-scroll w-full
    lg:w-11/12 bg-primary shadow rounded-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="flexStart gap-7 p-5 bg-[#fff4d2] lg:min-w-56 rounded-xl">
          <img src={assets.graph} alt="" className="hidden sm:flex w-8" />
          <div>
            <h4>{dashboardData?.totalOrders?.toString().padStart(2, "0")}</h4>
            <h5 className="text-solid">Total Sales</h5>
          </div>
        </div>
        <div className="flexStart gap-7 p-5 bg-[#fff4d2] lg:min-w-56 rounded-xl">
          <img src={assets.dollar} alt="" className="hidden sm:flex w-8" />
          <div>
            <h4>{currency}{dashboardData?.totalRevenue?.toFixed(2) || 0}</h4>
            <h5 className="text-solid">Total Earning</h5>
          </div>
        </div>
      </div>
      {/* All Orders/Sales */}
      <div className="bg-primary mt-4">
         {dashboardData.orders.map((order) => (
        <div key={order._id} className="bg-white p-2 mt-3 rounded-2xl">
          <div className='flex flex-gap gap-8 gap-y-3 mb-3'>
          {/* <div className='flex flex-col gap-3 mb-3'> */}
            {/* Order Item */}
            {order.items.map((item, idx) => (
              <div key={idx} className="text-gray-700 w-full lg:w-1/3">
              {/* <div key={idx} className="text-gray-700 w-full"> */}
                <div className='flex flex-[2] gap-x-3'>
                  <div className='flexCenter bg-primary rounded-xl'>
                    <img src={item.product.images[0]} alt="" className='max-h max-w-20 object-contain' />
                  </div>
                  <div className='block ww-full'>
                    <h5 className="uppercase line-clamp-1">{item.product.title}</h5>
                    <div className="flex flex-wrap gap-3 max-sm:gap-y-1 mt-1">
                      <div className="flex items-center gap-x-2">
                        <h5 className="text-sm font-medium">Price:</h5>
                        <p>
                          {currency}
                          {item.product.price[item.size]}
                        </p>
                      </div>

                      <div className="flex items-center gap-x-2">
                        <h5 className="text-sm font-medium">Quantity:</h5>
                        <p>{item.quantity}</p>
                      </div>

                      <div className="flex items-center gap-x-2">
                        <h5 className="text-sm font-medium">Size:</h5>
                        <p>{item.size}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Order Summary */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-t border-gray-300 pt-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-x-2">
                <h5 className="text-sm font-medium">OrderId:</h5>
                <p className="text-gray-400 text-sm break-all">{order._id}</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-x-2">
                  <h5 className="text-sm font-medium">Customer:</h5>
                  <p className="text-gray-400 text-sm">
                    {order.address.firstName} {order.address.lastName}
                  </p>
                  <div className="flex items-center gap-x-2">
                    <h5 className="text-sm font-medium">Phone:</h5>
                    <p className="text-gray-400 text-sm">{order.address.phone}</p>
                  </div>
                </div>
              </div>
                <div className="flex items-center gap-x-2">
                    <h5 className="text-sm font-medium">Address:</h5>
                    <p className="text-gray-400 text-sm">
                    {order.address.street}, {order.address.city}, {order.address.state},
                    {order.address.country}, {order.address.zipcode}</p>
                </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-x-2">
                  <h5 className="text-sm font-medium">Date:</h5>
                  <p className="text-gray-400 text-sm">
                    {new Date(order.createdAt).toDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-x-2">
                  <h5 className="text-sm font-medium">Amount:</h5>
                  <p className="text-gray-400 text-sm">{order.amount}</p>
                </div>
              </div>
            </div>
              <div className="flex items-center gap-x-2">
                <h5 className="text-sm font-medium">Status:</h5>
                <select value={order.status} className="text-sm font-semibold p-1 ring-1
                ring-slate-900/5 rounded max-w-36 bg-primary">
                  <option value="Order Placed">Order Placed</option>
                  <option value="Paking">Paking</option>
                  <option value="Shipping">Shipping</option>
                  <option value="Out for delivery">Out for delivery </option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}

export default Dashboard