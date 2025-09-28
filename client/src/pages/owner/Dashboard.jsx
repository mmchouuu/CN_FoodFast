import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { assets, dummyDashboardData } from '../../assets/data'


const Dashboard = () => {
  const {user, currency} = useAppContext()
  const [dashboardData, setDashboardData] = useState({
    orders: [],
    totalOders: 0,
    totalRevennue: 0,
  })

  const getDashboardData = ()=> {
    setDashboardData(dummyDashboardData)
  }

  return (
    <div>
      <div>
        <div>
          <img src={assets.graph} alt="" className="hidden sm:flex w-8" />
          <div>
            <h4>{dashboardData?.totalOders?.toString().padStart(2, "0")}</h4>
            <h5 className="text-solid">Total Sales</h5>
          </div>
        </div>
         <div>
          <img src={assets.dollar} alt="" className="hidden sm:flex w-8" />
          <div>
            <h4>{dashboardData?.totalRevennue?.toFixed(2) || 0}</h4>
            <h5 className="text-solid">Total Earning</h5>
          </div>
        </div>
      </div>
      {/* All Orders/Sales */}
      <div>
        
      </div>
    </div>
  )
}

export default Dashboard