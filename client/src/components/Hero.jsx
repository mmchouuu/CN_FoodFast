import React from "react";
import { promotionSlides } from "../data/customerData";

const Hero = () => {
  const featuredPromos = promotionSlides.slice(0, 3);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-orange-100 via-white to-amber-100">
      <div className="max-padd-container py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr,1fr]">
          <div className="space-y-10">
            <div className="flex flex-wrap items-center gap-3">
              {featuredPromos.map((promo) => (
                <span
                  key={promo.id}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 shadow-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  {promo.headline}
                </span>
              ))}
            </div>

            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                Fresh bites for every mood
              </p>
              <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl lg:text-[56px]">
                Get more <span className="text-orange-500">for less</span> - 25% off the tastiest meals in town
              </h1>
              <p className="max-w-xl text-base text-gray-600 sm:text-lg">
                Breakfast cravings, late-night snacks or office lunches - Tasty Queen keeps every customer fuelled with fast delivery and chef crafted menus near you.
              </p>
            </div>

            <div className="space-y-2 rounded-3xl bg-white/80 p-6 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
                Delivery status
              </p>
              <p className="text-2xl font-bold text-gray-900">
                Order now - eat in 20 min
              </p>
              <p className="text-sm text-gray-600">
                All partner restaurants guarantee freshly prepared dishes and average delivery times under twenty minutes within District 1 and District 3.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[48px] bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 py-16 pl-16 pr-10 shadow-2xl">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
              <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/10 blur-xl" />
              <img
                src="/src/assets/Double_cheese_burger.png"
                alt="Signature burger"
                className="relative z-10 mx-auto block max-w-[360px] rotate-[8deg] drop-shadow-2xl lg:max-w-[420px]"
              />
              <div className="relative z-10 mt-10 space-y-3 rounded-3xl bg-white/90 p-6 text-gray-700 backdrop-blur">
                <p className="text-xs font-semibold uppercase text-orange-500">
                  Chef's pick today
                </p>
                <p className="text-lg font-bold text-gray-900">
                  Double cheese truffle burger
                </p>
                <p className="text-sm">
                  Layered with caramelised onions and a secret smoky glaze. Only{" "}
                  <span className="font-semibold text-orange-500">129,000 VND</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
