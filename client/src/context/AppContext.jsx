// src/context/AppContext.jsx
import { useNavigate } from 'react-router-dom';
import React, { createContext, useState, useContext, useEffect } from 'react'
import toast from 'react-hot-toast';

// --- Auth Systems ---
import { useAuth0 } from '@auth0/auth0-react';
import { useUser as useClerkUser } from "@clerk/clerk-react";
import authService from '../services/auth';
import {
  dishes as menuDishes,
  restaurants as restaurantList,
  currentOrders as liveOrders,
  orderHistory as historyOrders,
  notificationFeed,
  customerAddresses,
  paymentOptions as paymentOptionList,
  restaurantReviews as initialRestaurantReviews,
} from '../data/customerData';

const AppContext = createContext()

export const AppContextProvider = ({ children }) => {
    const navigate = useNavigate();

    // --- States ---
    const [products, setProducts] = useState(menuDishes);
    const [restaurants] = useState(restaurantList);
    const [activeOrders, setActiveOrders] = useState(liveOrders);
    const [pastOrders, setPastOrders] = useState(historyOrders);
    const [notifications, setNotifications] = useState(notificationFeed);
    const [addresses, setAddresses] = useState(customerAddresses);
    const [selectedAddressId, setSelectedAddressId] = useState(customerAddresses[0]?.id ?? null);
    const [restaurantReviews, setRestaurantReviews] = useState(initialRestaurantReviews);
    const [appliedDiscountCode, setAppliedDiscountCode] = useState(null);
    const [method, setMethod] = useState("COD");
    const [isOwner, setIsOwner] = useState(() => {
        try {
            const saved = localStorage.getItem("isOwner");
            return saved ? JSON.parse(saved) : false;
        } catch (e) {
            return false;
        }
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [cartItems, setCartItems] = useState({});
    const currency = import.meta.env.VITE_CURRENCY || "VND ";
    const delivery_charges = 15000;

    // --- Auth0 ---
    const { user: auth0User, isAuthenticated: isAuth0, loginWithRedirect, logout: logoutAuth0 } = useAuth0();

    // --- Clerk ---
    const { user: clerkUser } = useClerkUser();
    const isClerkAuthenticated = Boolean(clerkUser);

    // --- Local auth (via API Gateway) ---
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'));
    const [authProfile, setAuthProfile] = useState(() => {
        try { return JSON.parse(localStorage.getItem('auth_profile') || 'null'); } catch { return null; }
    });

    // --- Unified user object ---
    const user = authProfile || auth0User || clerkUser || null;

    // --- Cart Functions ---
    const addToCart = (itemId, size, quantity = 1) => {
        const dish = products.find(item => item._id === itemId);
        if (!dish) {
            toast.error("Dish not found.");
            return;
        }
        if (dish.sizes?.length && !size) {
            toast.error("Please choose a size before adding this dish.");
            return;
        }
        const effectiveSize = size || dish.sizes?.[0] || "Default";
        setCartItems(prev => {
            const updated = structuredClone(prev);
            updated[itemId] = updated[itemId] || {};
            updated[itemId][effectiveSize] = (updated[itemId][effectiveSize] || 0) + Math.max(quantity, 1);
            return updated;
        });
        toast.success(`${dish.title} was added to your cart.`);
    };

    const getCartCount = () => {
        return Object.values(cartItems).reduce((count, sizes) =>
            count + Object.values(sizes).reduce((sum, qty) => sum + qty, 0), 0);
    };

    const updateQuantity = (itemId, size, quantity) => {
        setCartItems(prev => {
            const updated = structuredClone(prev);
            if (!updated[itemId]) {
                return prev;
            }
            if (quantity <= 0) {
                delete updated[itemId][size];
                if (Object.keys(updated[itemId]).length === 0) {
                    delete updated[itemId];
                }
            } else {
                updated[itemId][size] = quantity;
            }
            return updated;
        });
    };

    const getCartAmount = () => {
        let total = 0;
        for (const itemId in cartItems) {
            const product = products.find(p => p._id === itemId);
            if (!product) continue;
            for (const size in cartItems[itemId]) {
                total += product.price[size] * cartItems[itemId][size];
            }
        }
        return total;
    };

    const clearCart = () => setCartItems({});

    // Persist owner flag
    useEffect(() => {
        try {
            localStorage.setItem("isOwner", JSON.stringify(isOwner));
        } catch (e) {
            // ignore
        }
    }, [isOwner]);

    // Persist local auth
    useEffect(() => {
        if (authToken) localStorage.setItem('auth_token', authToken); else localStorage.removeItem('auth_token');
    }, [authToken]);
    useEffect(() => {
        try {
            if (authProfile) localStorage.setItem('auth_profile', JSON.stringify(authProfile));
            else localStorage.removeItem('auth_profile');
        } catch {}
    }, [authProfile]);

    const sanitizeUser = (rawUser) => {
        if (!rawUser) return null;
        return {
            id: rawUser.id,
            first_name: rawUser.first_name,
            last_name: rawUser.last_name,
            email: rawUser.email,
            role: rawUser.role,
        };
    };

    // --- Local auth actions ---
    const loginWithCredentials = async (email, password) => {
        try {
            const res = await authService.login(email, password);
            if (res?.token) setAuthToken(res.token);
            if (res?.user) setAuthProfile(sanitizeUser(res.user));
            toast.success(res?.message || 'Logged in successfully');
            return res;
        } catch (error) {
            const message = error?.response?.data?.message || error.message || 'Login failed';
            toast.error(message);
            throw error;
        }
    };

    const signupWithCredentials = async ({ firstName, lastName, email, password, phone }) => {
        try {
            const res = await authService.register({ firstName, lastName, email, password, phone });
            toast.success(res?.message || 'Account created. Please check your email for the OTP.');
            return res;
        } catch (error) {
            const message = error?.response?.data?.message || error.message || 'Sign up failed';
            toast.error(message);
            throw error;
        }
    };

    const requestPasswordReset = async (email) => {
        try {
            const res = await authService.requestPasswordReset(email);
            toast.success(res?.message || 'If email exists, you will receive reset instructions.');
            return res;
        } catch (error) {
            toast.error('Unable to process request right now.');
            throw error;
        }
    };

    const logoutLocal = () => {
        setAuthToken(null);
        setAuthProfile(null);
        toast('Logged out');
    };

    const verifyOtp = async (email, otp) => {
        try {
            const res = await authService.verify(email, otp);
            toast.success(res?.message || 'Verification successful.');
            return res;
        } catch (error) {
            const message = error?.response?.data?.message || error.message || 'Verification failed';
            toast.error(message);
            throw error;
        }
    };

    // --- Restaurant Helpers ---
    const getRestaurantById = (restaurantId) => restaurants.find(restaurant => restaurant.id === restaurantId);
    const getDishById = (dishId) => products.find(item => item._id === dishId);
    const getDishesByRestaurant = (restaurantId) =>
        products.filter(item => item.restaurantId === restaurantId);

    const selectedAddress = addresses.find(address => address.id === selectedAddressId) || null;

    const applyDiscountCode = (code) => {
        const trimmed = code.trim();
        if (!trimmed) {
            setAppliedDiscountCode(null);
            toast.dismiss();
            toast("Discount code cleared");
            return;
        }
        const normalized = trimmed.toUpperCase();
        if (normalized === "FREESHIP") {
            setAppliedDiscountCode({ code: normalized, type: "shipping", value: delivery_charges });
            toast.success("Free shipping applied");
        } else if (normalized === "WELCOME10") {
            setAppliedDiscountCode({ code: normalized, type: "percentage", value: 10 });
            toast.success("Welcome 10% discount applied");
        } else {
            toast.error("Discount code is not valid");
        }
    };

    const getDiscountAmount = (subtotal) => {
        if (!appliedDiscountCode) return 0;
        if (appliedDiscountCode.type === "shipping") {
            return Math.min(appliedDiscountCode.value, delivery_charges);
        }
        if (appliedDiscountCode.type === "percentage") {
            return Math.round((subtotal * appliedDiscountCode.value) / 100);
        }
        return 0;
    };

    const markNotificationAsRead = (id) => {
        setNotifications(prev =>
            prev.map(notification =>
                notification.id === id ? { ...notification, read: true } : notification
            )
        );
    };

    const addNewAddress = (address) => {
        setAddresses(prev => {
            const updated = [...prev, address];
            if (address.isDefault) {
                updated.forEach(item => {
                    if (item.id !== address.id) {
                        item.isDefault = false;
                    }
                });
                setSelectedAddressId(address.id);
            }
            return updated;
        });
    };

    const updateAddress = (addressId, updates) => {
        setAddresses(prev =>
            prev.map(address =>
                address.id === addressId ? { ...address, ...updates } : address
            )
        );
    };

    const removeAddress = (addressId) => {
        setAddresses(prev => prev.filter(address => address.id !== addressId));
        setSelectedAddressId(prev => (prev === addressId ? null : prev));
    };

    const updateLocalProfile = (updates) => {
        setAuthProfile(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...updates };
            toast.success('Profile updated');
            return updated;
        });
    };

    const addRestaurantReview = (review) => {
        setRestaurantReviews(prev => [review, ...prev]);
    };

    const getReviewsForRestaurant = (restaurantId) =>
        restaurantReviews.filter(review => review.restaurantId === restaurantId);

    const getRestaurantRatingSummary = (restaurantId) => {
        const reviews = getReviewsForRestaurant(restaurantId);
        if (!reviews.length) {
            return {
                average: null,
                count: 0,
            };
        }
        const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        return {
            average: parseFloat((total / reviews.length).toFixed(2)),
            count: reviews.length,
        };
    };

    // --- Exposed Values ---
    const value = {
        user,
        products,
        currency,
        navigate,
        delivery_charges,
        searchQuery,
        setSearchQuery,
        cartItems,
        setCartItems,
        addToCart,
        getCartCount,
        updateQuantity,
        getCartAmount,
        getDiscountAmount,
        method,
        setMethod,
        isOwner,
        setIsOwner,
        restaurants,
        getRestaurantById,
        getDishesByRestaurant,
        getDishById,
        activeOrders,
        setActiveOrders,
        pastOrders,
        setPastOrders,
        addresses,
        selectedAddress,
        selectedAddressId,
        setSelectedAddressId,
        addNewAddress,
        updateAddress,
        removeAddress,
        applyDiscountCode,
        appliedDiscountCode,
        notifications,
        markNotificationAsRead,
        clearCart,
        paymentOptions: paymentOptionList,
        restaurantReviews,
        addRestaurantReview,
        getReviewsForRestaurant,
        getRestaurantRatingSummary,
        updateLocalProfile,

        // Auth Actions
        isAuthenticated: Boolean(user),
        // Local auth
        loginWithCredentials,
        signupWithCredentials,
        requestPasswordReset,
        logoutLocal,
        verifyOtp,
        // Third-party auth (optional)
        loginWithRedirect,      // For Auth0
        logoutAuth0
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
