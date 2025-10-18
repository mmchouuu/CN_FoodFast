import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import RatingStars from "./RatingStars"; // ⭐ Dùng component hiển thị sao
import { useAppContext } from "../context/AppContext";
import {
  pickFirstImageUrl,
  restaurantPlaceholderImage,
} from "../utils/imageHelpers";

const FeaturedRestaurants = () => {
  const navigate = useNavigate();
  const { restaurants: restaurantList } = useAppContext();
  const restaurants = useMemo(
    () => restaurantList.slice(0, 8),
    [restaurantList],
  );

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
                onClick={() => navigate(`/restaurants/${res.id}`)}
                className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition"
              >
                <img
                  src={pickFirstImageUrl(
                    restaurantPlaceholderImage,
                    res.heroImage,
                    res.coverImage,
                    res.images,
                  )}
                  alt={res.name}
                  className="w-full h-48 object-cover object-center transition duration-300 hover:scale-105"
                />
                <div className="p-4 text-center">
                  <h3 className="text-lg font-semibold text-gray-800">{res.name}</h3>
                  <p className="text-gray-500 text-sm mb-2">
                    {res.mapHint || res.address}
                  </p>

                  {/* ⭐ RatingStars component */}
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <RatingStars rating={res.rating ?? 0} />
                    <span>{(res.rating ?? 0).toFixed(1)}</span>
                    {res.reviewCount ? (
                      <span className="text-xs text-gray-400">
                        · {res.reviewCount} reviews
                      </span>
                    ) : null}
                  </div>
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
