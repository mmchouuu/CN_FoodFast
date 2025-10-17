import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { promotionSlides } from "../data/customerData";

const PromotionCarousel = () => {
  const navigate = useNavigate();
  const slides = Array.isArray(promotionSlides) ? promotionSlides : [];
  const [activeIndex, setActiveIndex] = useState(0);

  if (!slides.length) return null;

  const goTo = (index) => {
    const total = slides.length;
    setActiveIndex(((index % total) + total) % total);
  };

  const current = slides[activeIndex];

  return (
    <section className="relative rounded-[32px] bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 px-8 py-10 text-white shadow-lg">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="md:w-2/3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80">
            Today's promotion
          </p>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">
            {current.headline}
          </h2>
          <p className="mt-2 text-base text-white/90 md:text-lg">
            {current.body}
          </p>
          {current.actionHref ? (
            <button
              onClick={() => navigate(current.actionHref)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-orange-600 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {current.actionLabel}
              <span aria-hidden="true">&gt;</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-4 md:flex-col">
          <button
            aria-label="Previous promotion"
            className="rounded-full bg-white/20 px-3 py-2 text-lg font-bold transition hover:bg-white/30"
            onClick={() => goTo(activeIndex - 1)}
          >
            &lt;
          </button>

          <div className="flex items-center gap-2 md:flex-col">
            {slides.map((slide, index) => (
              <button
                key={slide.id ?? index}
                aria-label={`View promotion ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={`h-2 w-8 rounded-full transition md:h-8 md:w-2 ${
                  activeIndex === index ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>

          <button
            aria-label="Next promotion"
            className="rounded-full bg-white/20 px-3 py-2 text-lg font-bold transition hover:bg-white/30"
            onClick={() => goTo(activeIndex + 1)}
          >
            &gt;
          </button>
        </div>
      </div>
    </section>
  );
};

export default PromotionCarousel;
