import React, { useState, useEffect } from 'react';
import Title from './Title'
// import { dummyProducts } from '../assets/data';
import Item from './Item';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
// Import Swiper styles
import 'swiper/css';
// import required modules
import { Autoplay } from 'swiper/modules';
import { useAppContext } from '../context/AppContext';

const NewArrivals = () => {
  const [newArrivals, setNewArrivals] = useState([])
  const {products} = useAppContext()

  useEffect(()=>{
    const data = products.filter((item)=> item.inStock).slice(0, 7)
    setNewArrivals(data)
  }, [products])

  return (
    <section className='max-padd-container py-22 xl:py-28 bg-white'>
      <Title title1={"New"} title2={"Arivals"} titleStyles={"pb-10"} />
      <Swiper
        spaceBetween={30}
        autoplay={{
          delay: 3500,
          disableOnInteraction: false,
        }}
        breakpoints={{
          500: {
            slidesPerView: 2,
          },
          700: {
            slidesPerView: 3,
          },
          1022: {
            slidesPerView: 4,
          },
          1350: {
            slidesPerView: 5,
          },
        }}
        modules={[Autoplay]}
        className="min-h-[399px]"
      >
        {newArrivals.map((product)=> (
        <SwiperSlide key={product._id}>
          <Item product={product} />
        </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}

export default NewArrivals
