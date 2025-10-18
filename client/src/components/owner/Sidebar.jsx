import React, { useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'
import { assets } from '../../assets/data'
import { Link, NavLink, Outlet } from "react-router-dom"
import { UserButton } from '@clerk/clerk-react'

const Sidebar = () => {
    const { navigate, isOwner, user } = useAppContext()

    const navItems = [
        {
            path: "/owner",
            label: "Dashboard",
            icon: assets.dashboard,
        },
        {
            path: "/owner/profile",
            label: "Restaurant Info",
            icon: assets.house,
        },
        {
            path: "/owner/menu",
            label: "Dish Management",
            icon: assets.list,
        },
        {
            path: "/owner/orders",
            label: "Order Management",
            icon: assets.graph,
        },
        {
            path: "/owner/shippers",
            label: "Shipper Management",
            icon: assets.delivery,
        },
        {
            path: "/owner/assignments",
            label: "Assign Orders",
            icon: assets.forward,
        },
        {
            path: "/owner/tracking",
            label: "Delivery Tracking",
            icon: assets.map,
        },
        {
            path: "/owner/promotions",
            label: "Promotions",
            icon: assets.badge,
        },
        {
            path: "/owner/feedback",
            label: "Customer Feedback",
            icon: assets.star,
        },
        {
            path: "/owner/revenue",
            label: "Revenue Statistics",
            icon: assets.dollar,
        },
        {
            path: "/owner/account",
            label: "Account Management",
            icon: assets.user,
        },
    ]

    useEffect(() => {
        if (!isOwner) {
            navigate("/")
        }
    }, [isOwner])

    return (
        <div>
            {/* CONTAINER */}
            <div className="mx-auto max-w-[1440px] flex flex-col md:flex-row bg-white">
                {/* SIDEBAR - Left Side*/}
                <div className="max-md:flexCenter flex flex-col justify-between bg-primary sm:m-3
                md:sticky md:top-3 md:self-start md:min-w-[20%] md:h-[97vh] md:overflow-y-auto rounded-xl shadow">
                    <div className="flex flex-col gap-y-6 max-md:items-center md:flex-col md:pt-5">
                        <div className="w-full flex justify-between md:flex-col">
                            {/* Logo */}
                            <div className="flex flex-1 p-3 lg:pl-12">
                                <Link to="/" className="flex items-end">
                                    <img src={assets.logoImg} alt="logoImg" className="h-12" />
                                    <div className="">
                                        <span className="hidden sm:block font-extrabold text-3xl relative top-1 left-1">
                                            Tasty
                                        </span>
                                        <span className="hidden sm:block font-extrabold text-xs relative left-1.5 tracking-[10px] uppercase text-orange-500">
                                            Queen
                                        </span>
                                    </div>
                                </Link>
                            </div>
                            {/* User */}
                            <div className="md:hidden first-letter: items-center gap-3 md:bg-primary rounded-b-xl
                            p-2 pl-5 lg:pl-10 md:mt-10">
                                <UserButton
                                    appearance={{
                                        elements: {
                                            userButtonAvatarBox: {
                                                width: "42px",
                                                height: "42px",
                                            },
                                        },
                                    }}
                                />
                                <div className="text-sm font-semibold text-gray-800 capitalize">
                                    {user?.firstName} {user?.lastName}
                                </div>
                            </div>
                        </div>
                        <div className="flex md:flex-col md:gap-x-5 gap-y-8 md:mt-4">
                            {navItems.map((link) => (
                                <NavLink
                                    key={link.label}
                                    to={link.path}
                                    end={link.path === "/owner"}
                                    className={({ isActive }) =>
                                        isActive
                                            ? "flexStart gap-x-2 p-5 lg:pl-12 text-[13px] font-bold sm:!text-sm cursor-pointer h-10 bg-solid/10 max-md:border-b-4 md:border-r-4 borsolisolid"
                                            : "flexStart gap-x-2 lg:pl-12 p-5 text-[13px] font-bold sm:!text-sm cursor-pointer h-10 rounded-xl"
                                    }

                                >
                                    <img src={link.icon} alt={link.label} className="hidden md:block" width={18} />
                                    <div>{link.label}</div>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-3 md:bg-primary rounded-b-xl
                    p-2 pl-5 lg:pl-10 md:mt-10 border-t border-slate-900/15">
                        {/* User */}
                        <UserButton
                            appearance={{
                                elements: {
                                    userButtonAvatarBox: {
                                        width: "42px",
                                        height: "42px",
                                    },
                                },
                            }}
                        />
                        <div className="text-sm font-semibold text-gray-800 capitalize">
                            {user?.firstName} {user?.lastName}
                        </div>
                    </div>
                </div>
                {/* Right Side */}
                <Outlet />
            </div>
        </div>
    )
}

export default Sidebar
