import React from "react";

const GradientBackgrounds = () => (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[60vh] w-[60vh] rounded-full bg-gradient-to-br from-indigo-200 via-lime-200 to-purple-300 opacity-30 blur-3xl" />
        <div className="absolute top-24 left-1/3 h-[32vh] w-[40vh] rounded-full bg-gradient-to-b from-orange-200 via-amber-200 to-rose-100 opacity-40 blur-2xl" />
        <div className="absolute -bottom-24 right-10 h-[45vh] w-[45vh] rounded-full bg-gradient-to-tr from-fuchsia-200 via-orange-300 to-rose-200 opacity-50 blur-3xl" />
    </div>
);

export default GradientBackgrounds;
