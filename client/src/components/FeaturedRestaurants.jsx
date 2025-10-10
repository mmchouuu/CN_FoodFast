import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import RatingStars from "./RatingStars"; // ⭐ Dùng component hiển thị sao

import product1 from "../assets/product_1.png";
import product2 from "../assets/product_2.png";
import product3 from "../assets/product_3.png";
import product4 from "../assets/product_4.png";
import product5 from "../assets/product_5.png";
import product6 from "../assets/product_6.png";
import product7 from "../assets/product_7.png";
import product8 from "../assets/product_8.png";

const FeaturedRestaurants = () => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);

   useEffect(() => {
    const data = [
      { id: 1, name: "Tasty Queen", image: product1, location: "District 1, HCM", rating: 4.9 },
      { id: 2, name: "Urban Grill", image: product2, location: "District 3, HCM", rating: 4.8 },
      { id: 3, name: "Food Hub", image: product3, location: "Thu Duc City", rating: 4.7 },
      { id: 4, name: "Hot Plate", image: product4, location: "Go Vap, HCM", rating: 4.6 },
      { id: 5, name: "Fresh Feast", image: product5, location: "Tan Binh, HCM", rating: 4.9 },
      { id: 6, name: "Sakura Sushi", image: product6, location: "Binh Thanh, HCM", rating: 4.8 },
      { id: 7, name: "Pho House", image: product7, location: "District 10, HCM", rating: 4.7 },
      { id: 8, name: "Grill & Chill", image: product8, location: "District 5, HCM", rating: 4.8 },
    ];
    setRestaurants(data);
  }, []);

  return (
    <section id="featured-section" className="max-padd-container py-22 xl:py-28 bg-orange-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Featured Restaurants</h2>
          <button
            onClick={() => navigate("/menu")}
            className="text-orange-500 hover:text-orange-600 font-semibold"
          >
            View All →
          </button>
        </div>

        {/* Swiper Carousel */}
        <Swiper
          spaceBetween={30}
          autoplay={{
            delay: 3500,
            disableOnInteraction: false,
          }}
          breakpoints={{
            500: { slidesPerView: 2 },
            700: { slidesPerView: 3 },
            1022: { slidesPerView: 4 },
            1350: { slidesPerView: 5 },
          }}
          modules={[Autoplay]}
          className="min-h-[430px]"
        >
          {restaurants.map((res) => (
            <SwiperSlide key={res.id}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={() => navigate(`/menu/${res.id}`)}
                className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition"
              >
                <img src={res.image} alt={res.name} className="w-full h-48 object-cover" />
                <div className="p-4 text-center">
                  <h3 className="text-lg font-semibold text-gray-800">{res.name}</h3>
                  <p className="text-gray-500 text-sm mb-2">{res.location}</p>

                  {/* ⭐ RatingStars component */}
                  <RatingStars rating={res.rating} />
                </div>
              </motion.div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default FeaturedRestaurants;
