import React from 'react'
import { assets } from '../assets/data'; 

const Ratting = () => {
  return (
   <div className="flex items-center divide-x divide-gray-300">
            <div className="flex -space-x-3 pr-3">
                <img src={assets.user1} alt="image" className="w-12 h-12 rounded-full border-2 border-white hover:-translate-y-1 transition z-1" />
                <img src={assets.user2} alt="image" className="w-12 h-12 rounded-full border-2 border-white hover:-translate-y-1 transition z-1" />
                <img src={assets.user3} alt="image" className="w-12 h-12 rounded-full border-2 border-white hover:-translate-y-1 transition z-1" />
                <img src={assets.user4} alt="image" className="w-12 h-12 rounded-full border-2 border-white hover:-translate-y-1 transition z-1" />
                
            </div>
            <div className="pl-3">
                <div className="flex items-center gap-1 mb-1">
                    <img src={assets.star} alt="" width={20} />
                    <img src={assets.star} alt="" width={20} />
                    <img src={assets.star} alt="" width={20} />
                    <img src={assets.star} alt="" width={20} />
                    <img src={assets.star} alt="" width={20} />

                    <p className="text-gray-600 font-medium ml-2">5.0</p>
                </div>
                <p className="text-sm text-gray-500">Trusted by <span className="font-medium text-gray-800">100,000+</span> users</p>
            </div>
        </div>
  )
}

export default Ratting
