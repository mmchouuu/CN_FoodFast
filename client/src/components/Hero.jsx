import React from 'react'
import Ratting from './Ratting'

const Hero = () => {
  return (
    <section className='max-padd-container'>
        {/* <div className="lg:bg-[url('/src/assets/Double_cheese_burger.png')] bg-cover bg-center
        bg-no-repeat h-screen w-full rounded-2xl relative"> */}
        <div className="lg:bg-[url('/src/assets/Double_cheese_burger.png')] bg-right
        bg-no-repeat h-screen w-full rounded-2xl relative">
            {/* CONTAINER */}
            <div className='mx-auto max-w-[1440px] px-4 flex-col
            justify-between h-full'>
                {/* Top */}
                <div className='max-w-[788px] pt-44 lg:pt-58'>
                    <h3>Fresh Bites for Every Mood</h3>
                    <h2 className='uppercase !mb-0 tracking-[0.22rem]'>
                        {/* <span style={{ color: "#ac2c28" }}>Get More</span>
                        <span style={{ color: "#fd872f" }}>for Less - 25% Off!</span> */}
                       <span className="text-solidOne">Get More </span><span
                       className="text-solidTwo">for Less - 25% Off!</span>
                    </h2>
                    <h1 className='font-[800] leading-none'>
                        on Burger & Tacos
                    </h1>
                    <div className='flex item-center'>
                        <h3>
                            Starting from
                        </h3>
                        <span className='bg-white p-1 inline-block
                        ml-2.5 text-5xl font-extrabold'>
                            <span className='text-5xl'>45.000</span>
                        </span>
                    </div>
                    <button className='btn-solid !rounded-none p-5 w-52 text-lg
                    font-bold mt-8'>Shop Now</button>
                </div>
            {/* Bottom */}
            <div className=" mt-50 pb-9">
                <Ratting />
            </div>                 
            </div>           
        </div>
    </section>
  )
}

export default Hero
