import React from "react";
import { assets } from "../../assets/data";

const containerClasses =
    "md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-auto w-full lg:w-11/12 bg-primary shadow rounded-xl";

const businessHours = [
    { day: "Monday", open: "08:00", close: "21:00" },
    { day: "Tuesday", open: "08:00", close: "21:00" },
    { day: "Wednesday", open: "08:00", close: "21:00" },
    { day: "Thursday", open: "08:00", close: "21:00" },
    { day: "Friday", open: "08:00", close: "22:00" },
    { day: "Saturday", open: "08:00", close: "22:00" },
    { day: "Sunday", open: "09:00", close: "20:00" },
];

const RestaurantProfile = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Restaurant Profile</h1>
                    <p className="text-sm text-slate-600">
                        Update branding, operating hours, and contact information shown to customers.
                    </p>
                </div>
                <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                    Save Changes
                </button>
            </header>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2 space-y-5">
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Restaurant Name
                        </label>
                        <input
                            type="text"
                            defaultValue="Tasty Queen - District 1"
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Contact Email
                            </label>
                            <input
                                type="email"
                                defaultValue="hello@tastyqueen.vn"
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Hotline
                            </label>
                            <input
                                type="tel"
                                defaultValue="1900 636 555"
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Address
                        </label>
                        <textarea
                            rows={3}
                            defaultValue="120 Nguyen Hue, Ben Nghe Ward, District 1, Ho Chi Minh City"
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Restaurant Description
                        </label>
                        <textarea
                            rows={4}
                            defaultValue="Serving authentic Vietnamese cuisine with fresh ingredients and signature soups. Family-friendly environment with fast delivery service."
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Logo
                            </label>
                            <div className="flex items-center gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                                <img src={assets.logoImg} alt="logo" className="h-12 w-12 rounded-lg object-contain" />
                                <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                    Upload New Logo
                                </button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Cover Photo
                            </label>
                            <div className="h-28 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-500">
                                Drag & drop a new cover photo here
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Opening Hours</h2>
                    <ul className="space-y-3 text-sm text-slate-600">
                        {businessHours.map(slot => (
                            <li
                                key={slot.day}
                                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                            >
                                <span className="font-semibold text-slate-700">{slot.day}</span>
                                <span className="text-xs text-slate-500">
                                    {slot.open} - {slot.close}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <button className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                        Modify Schedule
                    </button>
                </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                    <h2 className="text-lg font-semibold text-slate-900">Delivery Radius</h2>
                    <p className="text-sm text-slate-600">
                        Control how far delivery staff can deliver from this location.
                    </p>
                    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                        <span className="text-sm text-slate-600">Current radius</span>
                        <span className="text-base font-semibold text-slate-800">6 km</span>
                    </div>
                    <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">
                        Adjust Radius
                    </button>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Social & Branding</h2>
                    <div className="space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Facebook Page</span>
                            <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                Link Account
                            </button>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Instagram</span>
                            <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                Link Account
                            </button>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <span>Google Business</span>
                            <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                Verify Now
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default RestaurantProfile;
