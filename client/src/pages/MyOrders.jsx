import React, { useEffect, useState } from 'react'
import Title from '../components/Title'
import { useAppContext } from '../context/AppContext'
import { dummyOrdersData } from '../assets/data'

const MyOrders = () => {
  const { currency, user } = useAppContext()
  const [orders, setOrders] = useState([])

  const loadOrderData = () => {
    setOrders(dummyOrdersData)
  }

  useEffect(() => {
    if (user) {
      loadOrderData();
    }
  }, [user]);

  return (
    <div className='max-padd-container py-16 pt-28 bg-primary'>
      <Title
        title1={"My"}
        title2={"Orders List"}
        titleStyles={"items-start pb-5"}
        paraStyles={"hidden"}
      />
      {orders.map((order) => (
        <div key={order._id} className="bg-white p-2 mt-3 rounded-2xl">
          <div className='flex flex-gap gap-8 gap-y-3 mb-3'>
            {/* Order Item */}
            {order.items.map((item, idx) => (
              <div key={idx} className="text-gray-700 w-full lg:w-1/3">
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
                  <h5 className="text-sm font-medium">Payment Status:</h5>
                  <p className="text-gray-400 text-sm">
                    {order.isPaid ? "Done" : "Pending"}
                  </p>
                  <div className="flex items-center gap-x-2">
                    <h5 className="text-sm font-medium">Method:</h5>
                    <p className="text-gray-400 text-sm">{order.paymentMethod}</p>
                  </div>
                </div>
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
            <div className='flex gap-3'>
              <div className="flex items-center gap-x-2">
                <h5 className="text-sm font-medium">Status:</h5>
                <div className="flex items-center gap-1">
                  <span className="min-w-2 h-2 rounded-full bg-green-500" />
                  <p>{order.status}</p>
                </div>
              </div>
              <button
                onClick={loadOrderData} className="btn-solid py-1 !text-xs rounded-sm">
                Track Order
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyOrders
