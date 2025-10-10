// import React from 'react'
// import Hero from '../components/Hero' 
// import NewArrivals from '../components/NewArrivals'
// import About from '../components/About'
// import PopularProducts from '../components/PopularProducts'
// import Testimonial from '../components/Testimonial'

// const Home = () => {
//   return (
//     <>
//       <Hero />
//       <NewArrivals />
//       <About />
//       <PopularProducts />
//       <Testimonial />
//     </>
//   )
// }

// export default Home

// src/pages/Home.jsx
import React from "react";

// Components
import Hero from "../components/Hero";
import FeaturedRestaurants from "../components/FeaturedRestaurants";
import NewArrivals from "../components/NewArrivals";
import PopularProducts from "../components/PopularProducts";
import About from "../components/About";
import Testimonial from "../components/Testimonial";

// Page
import Menu from "./Menu"; // Menu nằm trong pages

const Home = () => {
  return (
    <>
      {/* Banner chính */}
      <Hero />

      {/* Dải nhà hàng nổi bật */}
      <FeaturedRestaurants />

      {/* Sản phẩm mới */}
      <NewArrivals />

      {/* Món phổ biến */}
      <PopularProducts />

      {/* Giới thiệu */}
      <About />

      {/* Đánh giá người dùng */}
      <Testimonial />
    </>
  );
};

export default Home;
