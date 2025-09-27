import React from 'react'
import Hero from '../components/Hero' 
import NewArrivals from '../components/NewArrivals'
import About from '../components/About'
import PopularProducts from '../components/PopularProducts'
import Testimonial from '../components/Testimonial'

const Home = () => {
  return (
    <>
      <Hero />
      <NewArrivals />
      <About />
      <PopularProducts />
      <Testimonial />
    </>
  )
}

export default Home
