import React from "react";
import { assets } from "../../assets/data";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const menuItems = [
    {
        id: "pho-special",
        name: "Pho Special",
        category: "Main Course",
        status: "Available",
        basePrice: 68000,
        sizes: [
            { label: "Regular", price: 68000 },
            { label: "Large", price: 82000 },
        ],
        combos: ["Pho + Spring Roll", "Pho + Iced Tea"],
    },
    {
        id: "banh-mi",
        name: "Bánh Mì Classic",
        category: "Sandwich",
        status: "Available",
        basePrice: 45000,
        sizes: [
            { label: "Single", price: 45000 },
            { label: "Combo", price: 65000 },
        ],
        combos: ["Bánh Mì + Coffee"],
    },
    {
        id: "vegan-bowl",
        name: "Vegan Vermicelli Bowl",
        category: "Healthy",
        status: "Sold Out",
        basePrice: 72000,
        sizes: [
            { label: "Regular", price: 72000 },
            { label: "Large", price: 88000 },
        ],
        combos: ["Vegan Bowl + Detox Juice"],
    },
];

const toppingGroups = [
    {
        title: "Proteins",
        options: [
            { name: "Grilled Chicken", price: 12000 },
            { name: "Beef Brisket", price: 18000 },
            { name: "Tofu Cubes", price: 8000 },
        ],
    },
    {
        title: "Extras",
        options: [
            { name: "Extra Herbs", price: 5000 },
            { name: "Spicy Chili Oil", price: 6000 },
            { name: "Crispy Shallots", price: 7000 },
        ],
    },
];

const MenuManagement = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dish Management</h1>
                    <p className="text-sm text-slate-600">
                        Manage menu items, combos, toppings, and portion sizes across your restaurant.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                        <img src={assets.uploadIcon} alt="" className="h-4 w-4" />
                        Bulk Import
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                        <img src={assets.plus} alt="" className="h-4 w-4" />
                        Add Dish
                    </button>
                </div>
            </header>

            <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <img src={assets.search} alt="search" className="h-4 w-4" />
                            </span>
                            <input
                                type="search"
                                placeholder="Search dishes..."
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                            />
                        </div>
                        <select className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60">
                            <option value="">All Categories</option>
                            <option>Main Course</option>
                            <option>Appetizer</option>
                            <option>Dessert</option>
                            <option>Beverage</option>
                        </select>
                        <select className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60">
                            <option value="">Availability</option>
                            <option>Available</option>
                            <option>Sold Out</option>
                        </select>
                    </div>
                    <div className="flex gap-3">
                        <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">
                            Manage Categories
                        </button>
                        <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition">
                            Export Menu
                        </button>
                    </div>
                </div>
            </section>

            <section className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left uppercase text-xs font-medium text-slate-500 tracking-wide">
                        <tr>
                            <th className="px-6 py-4">Dish</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Sizes & Pricing</th>
                            <th className="px-6 py-4">Combos</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {menuItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                                <td className="px-6 py-4">
                                    <p className="font-semibold text-slate-800">{item.name}</p>
                                    <p className="text-xs text-slate-500">#{item.id}</p>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{item.category}</td>
                                <td className="px-6 py-4">
                                    <ul className="space-y-1 text-xs text-slate-500">
                                        {item.sizes.map(size => (
                                            <li key={size.label} className="flex items-center justify-between gap-4">
                                                <span>{size.label}</span>
                                                <span className="font-semibold text-slate-700">
                                                    {size.price.toLocaleString()}đ
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="px-6 py-4">
                                    <ul className="space-y-1 text-xs text-slate-500">
                                        {item.combos.map(combo => (
                                            <li key={combo}>{combo}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={item.status} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="inline-flex items-center gap-2">
                                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                            Edit
                                        </button>
                                        <span className="h-4 w-px bg-slate-200" />
                                        <button className="text-xs font-semibold text-red-500 hover:text-red-600 transition">
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Combos & Upsells</h2>
                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                            Configure
                        </button>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600">
                        <li className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="font-medium text-slate-800">Lunch Combo A</p>
                                <p className="text-xs text-slate-500">
                                    Pho Special + Iced Tea · Save 10%
                                </p>
                            </div>
                            <span className="text-xs font-semibold text-emerald-600">Active</span>
                        </li>
                        <li className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 px-4 py-3">
                            <div>
                                <p className="font-medium text-slate-800">Family Bundle</p>
                                <p className="text-xs text-slate-500">
                                    2 Mains + 2 Drinks + Shared appetizer
                                </p>
                            </div>
                            <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                Activate
                            </button>
                        </li>
                    </ul>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Toppings & Add-ons</h2>
                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                            Add Group
                        </button>
                    </div>
                    <div className="space-y-4">
                        {toppingGroups.map(group => (
                            <div key={group.title} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
                                    <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
                                        Edit
                                    </button>
                                </div>
                                <ul className="space-y-2 text-xs text-slate-600">
                                    {group.options.map(option => (
                                        <li key={option.name} className="flex items-center justify-between">
                                            <span>{option.name}</span>
                                            <span className="font-semibold text-slate-700">
                                                +{option.price.toLocaleString()}đ
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const styles =
        status === "Available"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-200 text-slate-700";

    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
            {status}
        </span>
    );
};

export default MenuManagement;






