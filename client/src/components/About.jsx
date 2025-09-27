import React from 'react'
import Title from './Title'
import { assets } from '../assets/data'

const About = () => {
    return (
        <section className='max-padd-container py-12 xl:py-24'>
            {/* CONTAINER */}
            <div className='flexCenter flex-col gap-16 xl:gap-8 xl:flex-row'>
                {/* Left Side */}
                <div className='flex-1'>
                    <Title title1={"Discover Our "} title2={"Food App's key features!"} titleStyles={"items-start pb-10"} paraStypes={
                        "text-start"} />
                    <div className="flex flex-col items-start gap-y-4">
                        <div className='flexCenter gap-x-4'>
                            <div className='h-16 min-w-16 flexCenter rounded-md' style={{background: "#dc583e"}}>
                                <img src={assets.delivery} alt="" width={22} className='invert' />
                            </div>
                            <div>
                                <h4>Fast Food Delivery</h4>
                                <p>Get your favorite meals delivered hot and fresh to your door in just a few minutes.</p>
                            </div>
                        </div>
                        <div className='flexCenter gap-x-4'>
                            <div className='h-16 min-w-16 flexCenter rounded-md' style={{background: "#dc583e"}}>
                                <img src={assets.secure} alt="" width={22} className='invert' />
                            </div>
                            <div>
                                <h4>Secure Online Payment</h4>
                                <p>Pay securely using your preferred payment methods with a simple and quick checkout.</p>
                            </div>
                        </div>
                        <div className='flexCenter gap-x-4'>
                            <div className='h-16 min-w-16 flexCenter rounded-md' style={{background: "#dc583e"}}>
                                <img src={assets.phone} alt="" width={22} className='invert' />
                            </div>
                            <div> 
                                <h4>24/7 Order Support</h4>
                                <p>Our support team is always ready to assist you with any order queries or issues.</p>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Right Side */}
                <div className='flex-1 flexCenter gap-5'>
                    <div className='flex-1'>
                        <img src={assets.features1} alt="" className='rounded-3xl'/>
                    </div>
                    <div className='flex-1 flex gap-5 flex-col'>
                        <img src={assets.features3} alt="" className='rounded-3xl'/>
                        <img src={assets.features2} alt="" className='rounded-3xl'/>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default About
