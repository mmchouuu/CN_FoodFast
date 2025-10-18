// src/context/AppContext.jsx
import { useNavigate } from 'react-router-dom';
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast';
import catalogService from '../services/catalog';
import ordersService from '../services/orders';
import paymentsService from '../services/payments';
import { restaurantPlaceholderImage, dishPlaceholderImage } from '../utils/imageHelpers';

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

const createAuth0Fallback = () => ({
  user: null,
  isAuthenticated: false,
  loginWithRedirect: async () => {
    toast.error('Đăng nhập bằng Auth0 chưa được cấu hình.');
  },
  logout: async () => {
    toast.error('Auth0 chưa được cấu hình nên không thể đăng xuất.');
  },
});

const useSafeAuth0 = () => {
  try {
    return useAuth0();
  } catch (error) {
    if (import.meta?.env?.DEV) {
      console.warn('Auth0Provider is missing; Auth0 features disabled.', error);
    }
    return createAuth0Fallback();
  }
};

const FALLBACK_PRODUCTS = menuDishes;
const FALLBACK_RESTAURANTS = restaurantList;
const FALLBACK_ACTIVE_ORDERS = liveOrders;
const FALLBACK_ORDER_HISTORY = historyOrders;

const ORDER_HISTORY_STATUSES = new Set(['delivered', 'completed', 'cancelled']);
const ORDER_REVIEWABLE_STATUSES = new Set(['delivered', 'completed']);

const toNumberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const adaptRestaurantFromApi = (restaurant) => {
  if (!restaurant) return null;
  const images = ensureArray(restaurant.images).filter(Boolean);
  const heroImage = images[0] || restaurant.heroImage || restaurant.coverImage || restaurantPlaceholderImage;
  const coverImage = images[1] || heroImage;
  const createdAt = restaurant.created_at ? new Date(restaurant.created_at).getTime() : undefined;
  const updatedAt = restaurant.updated_at ? new Date(restaurant.updated_at).getTime() : undefined;
  return {
    id: restaurant.id,
    name: restaurant.name || 'Restaurant',
    description: restaurant.description || '',
    address: restaurant.address || restaurant.description || 'Thông tin đang được cập nhật.',
    distanceKm: toNumberOr(restaurant.distance_km, 0),
    rating: toNumberOr(restaurant.avg_branch_rating, 0),
    reviewCount: toNumberOr(restaurant.total_branch_ratings, 0),
    heroImage,
    coverImage,
    images: images.length ? images : [restaurantPlaceholderImage],
    tags: restaurant.cuisine ? [restaurant.cuisine] : [],
    cuisine: restaurant.cuisine,
    phone: restaurant.phone,
    email: restaurant.email,
    mapHint: restaurant.cuisine || 'Đang cập nhật',
    promotions: [],
    featuredDishIds: [],
    categories: restaurant.cuisine ? [restaurant.cuisine] : [],
    createdAt,
    updatedAt,
  };
};

const adaptProductFromApi = (product) => {
  if (!product) return null;
  const images = ensureArray(product.images).filter(Boolean);
  const basePrice = toNumberOr(product.base_price, 0);
  const createdAt = product.created_at ? new Date(product.created_at).getTime() : undefined;
  const updatedAt = product.updated_at ? new Date(product.updated_at).getTime() : undefined;
  return {
    _id: product.id,
    restaurantId: product.restaurant_id,
    title: product.title || 'Sản phẩm',
    description: product.description || '',
    category: product.category || 'General',
    type: product.type || 'Standard',
    spiceLevel: product.spice_level || 0,
    sizes: ['Standard'],
    price: { Standard: basePrice },
    basePrice,
    images: images.length ? images : [dishPlaceholderImage],
    tags: product.popular ? ['Popular'] : [],
    rating: toNumberOr(product.rating, 0),
    reviewCount: toNumberOr(product.review_count, 0),
    toppings: [],
    options: [],
    preparation: {
      prepMinutes: toNumberOr(product.prep_minutes, 5),
      cookMinutes: toNumberOr(product.cook_minutes, 15),
    },
    createdAt,
    updatedAt,
  };
};

const buildDefaultTimeline = (status, placedAt) => {
  const lowerStatus = (status || '').toLowerCase();
  const placedTime = placedAt
    ? new Date(placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const isPreparing = ['preparing', 'delivering', 'delivered', 'completed'].includes(lowerStatus);
  const isDelivering = ['delivering', 'delivered', 'completed'].includes(lowerStatus);
  const isDelivered = ['delivered', 'completed'].includes(lowerStatus);

  return [
    { id: 'stage-confirmed', label: 'Order confirmed', timestamp: placedTime, completed: true },
    { id: 'stage-preparing', label: 'Preparing', timestamp: null, completed: isPreparing },
    { id: 'stage-delivering', label: 'Out for delivery', timestamp: null, completed: isDelivering },
    { id: 'stage-delivered', label: 'Delivered', timestamp: null, completed: isDelivered },
  ];
};

const adaptOrderFromApi = (order) => {
  if (!order) return null;
  const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {};
  const pricing = metadata.pricing && typeof metadata.pricing === 'object' ? metadata.pricing : {};
  const paymentMeta = metadata.payment && typeof metadata.payment === 'object' ? metadata.payment : {};
  const deliveryAddress = metadata.delivery_address || null;

  const placedAt = order.created_at || metadata.placed_at || new Date().toISOString();
  const lowerStatus = (order.status || '').toLowerCase();
  const totalAmount = toNumberOr(pricing.total ?? order.total_amount, 0);
  const subtotal = toNumberOr(pricing.subtotal ?? order.total_amount, totalAmount);
  const shippingFee = toNumberOr(pricing.shipping_fee, 0);
  const discount = toNumberOr(pricing.discount, 0);
  const etaMinutes = toNumberOr(metadata.eta_minutes, 30);
  const paymentMethodRaw = typeof paymentMeta.method === 'string' ? paymentMeta.method : 'cod';
  const paymentMethod = paymentMethodRaw.toUpperCase();
  const timeline =
    Array.isArray(metadata.timeline) && metadata.timeline.length
      ? metadata.timeline
      : buildDefaultTimeline(lowerStatus, placedAt);

  return {
    id: order.id,
    restaurantId: order.restaurant_id,
    branchId: order.branch_id,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod,
    paymentMethodKey: paymentMethodRaw,
    totalAmount,
    subtotal,
    shippingFee,
    discount,
    currency: order.currency || 'VND',
    placedAt,
    updatedAt: order.updated_at,
    deliveredAt: metadata.delivered_at || null,
    etaMinutes,
    timeline,
    courier: metadata.courier || null,
    deliveryAddress,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          id: item.id,
          orderItemId: item.id,
          dishId: item.product_id,
          productId: item.product_id,
          size: item.product_snapshot?.size || item.product_snapshot?.variant || 'Standard',
          quantity: item.quantity,
          unitPrice: toNumberOr(item.unit_price, 0),
          price: toNumberOr(item.total_price, 0),
          productSnapshot: item.product_snapshot || {},
        }))
      : [],
    metadata,
    canReview: ORDER_REVIEWABLE_STATUSES.has(lowerStatus),
  };
};

const sortOrdersByPlacedAt = (orders) =>
  [...orders].sort((a, b) => {
    const dateA = a?.placedAt ? new Date(a.placedAt).getTime() : 0;
    const dateB = b?.placedAt ? new Date(b.placedAt).getTime() : 0;
    return dateB - dateA;
  });

const splitOrdersByStatus = (orders) => {
  const active = [];
  const past = [];
  for (const order of orders) {
    const status = (order?.status || '').toLowerCase();
    if (ORDER_HISTORY_STATUSES.has(status)) past.push(order);
    else active.push(order);
  }
  return {
    active: sortOrdersByPlacedAt(active),
    past: sortOrdersByPlacedAt(past),
  };
};

const AppContext = createContext()

export const AppContextProvider = ({ children }) => {
    const navigate = useNavigate();

    // --- States ---
    const [products, setProducts] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState(null);
    const [activeOrders, setActiveOrders] = useState([]);
    const [pastOrders, setPastOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [notifications, setNotifications] = useState(notificationFeed);
    const [addresses, setAddresses] = useState(customerAddresses);
    const [selectedAddressId, setSelectedAddressId] = useState(customerAddresses[0]?.id ?? null);
    const selectedAddress = useMemo(
        () => addresses.find(address => address.id === selectedAddressId) || null,
        [addresses, selectedAddressId]
    );
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

    const refreshCatalog = useCallback(async ({ signal } = {}) => {
        if (signal?.aborted) {
            return { cancelled: true };
        }

        setCatalogLoading(true);
        setCatalogError(null);

        try {
            const [restaurantData, productData] = await Promise.all([
                catalogService.fetchRestaurants({ limit: 50 }),
                catalogService.fetchProducts({ limit: 50 }),
            ]);

            if (signal?.aborted) {
                return { cancelled: true };
            }

            const adaptedRestaurants = Array.isArray(restaurantData)
                ? restaurantData.map(adaptRestaurantFromApi).filter(Boolean)
                : [];
            const adaptedProducts = Array.isArray(productData)
                ? productData.map(adaptProductFromApi).filter(Boolean)
                : [];

            setRestaurants(adaptedRestaurants);
            setProducts(adaptedProducts);

            return { success: true };
        } catch (error) {
            if (signal?.aborted) {
                return { cancelled: true };
            }
            console.error('Failed to load catalog data from product-service', error);
            setCatalogError(error?.message || 'Không thể tải dữ liệu món ăn / nhà hàng.');
            setRestaurants(prev => (prev.length ? prev : FALLBACK_RESTAURANTS));
            setProducts(prev => (prev.length ? prev : FALLBACK_PRODUCTS));
            return { success: false, error };
        } finally {
            if (!signal?.aborted) {
                setCatalogLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        refreshCatalog({ signal: controller.signal });
        return () => controller.abort();
    }, [refreshCatalog]);

    // --- Auth0 ---
    const { user: auth0User, isAuthenticated: isAuth0, loginWithRedirect, logout: logoutAuth0 } = useSafeAuth0();

    // --- Clerk ---
    const { user: clerkUser } = useClerkUser();
    const isClerkAuthenticated = Boolean(clerkUser);

    // --- Local auth (via API Gateway) ---
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'));
    const [authProfile, setAuthProfile] = useState(() => {
        try { return JSON.parse(localStorage.getItem('auth_profile') || 'null'); } catch { return null; }
    });

    const refreshOrders = useCallback(async () => {
        if (!authToken) {
            setOrdersLoading(false);
            setActiveOrders([]);
            setPastOrders([]);
            return { cancelled: true };
        }
        setOrdersLoading(true);
        try {
            const data = await ordersService.list();
            const adapted = Array.isArray(data) ? data.map(adaptOrderFromApi).filter(Boolean) : [];
            const { active, past } = splitOrdersByStatus(adapted);
            setActiveOrders(active);
            setPastOrders(past);
            return { success: true, active, past };
        } catch (error) {
            console.error('Failed to load orders from order-service', error);
            setActiveOrders(prev => (prev.length ? prev : FALLBACK_ACTIVE_ORDERS));
            setPastOrders(prev => (prev.length ? prev : FALLBACK_ORDER_HISTORY));
            return { success: false, error };
        } finally {
            setOrdersLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        refreshOrders();
    }, [refreshOrders]);

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

    const getDiscountAmount = useCallback((subtotal) => {
        if (!subtotal || subtotal <= 0) {
            return 0;
        }
        if (!appliedDiscountCode) {
            return 0;
        }

        const { type, value } = appliedDiscountCode;

        if (type === 'shipping') {
            return Math.min(delivery_charges, subtotal);
        }

        if (type === 'percentage') {
            const percentage = toNumberOr(value, 0);
            if (percentage <= 0) {
                return 0;
            }
            const discount = (subtotal * percentage) / 100;
            return Math.min(subtotal, discount);
        }

        if (type === 'flat') {
            const flat = toNumberOr(value, 0);
            return Math.min(subtotal, flat);
        }

        return 0;
    }, [appliedDiscountCode, delivery_charges]);

    const placeOrder = useCallback(async ({ paymentMethod: paymentMethodOverride, address: addressOverride, notes } = {}) => {
        if (!authToken) {
            throw new Error('You need to sign in before placing an order.');
        }
        if (!user?.id) {
            throw new Error('We could not verify your customer profile. Please sign out and sign in again.');
        }

        const orderItems = [];
        const restaurantIds = new Set();
        for (const itemId in cartItems) {
            const product = products.find((item) => item._id === itemId);
            if (!product) continue;
            const sizeMap = cartItems[itemId] || {};
            for (const sizeKey in sizeMap) {
                const quantity = sizeMap[sizeKey];
                if (quantity <= 0) continue;
                const unitPrice = product.price?.[sizeKey] ?? product.basePrice ?? 0;
                const totalPrice = unitPrice * quantity;
                orderItems.push({
                    product_id: product._id,
                    variant_id: sizeKey !== 'Standard' ? sizeKey : null,
                    quantity,
                    unit_price: unitPrice,
                    total_price: totalPrice,
                    product_snapshot: {
                        title: product.title,
                        size: sizeKey,
                        image: product.images?.[0],
                        restaurant_id: product.restaurantId,
                    },
                });
                if (product.restaurantId) {
                    restaurantIds.add(product.restaurantId);
                }
            }
        }

        if (!orderItems.length) {
            throw new Error('Your cart is currently empty.');
        }

        if (restaurantIds.size > 1) {
            throw new Error('Please create separate orders for each restaurant.');
        }

        const fallbackRestaurantId = orderItems[0]?.product_snapshot?.restaurant_id || null;
        const restaurantId = Array.from(restaurantIds)[0] || fallbackRestaurantId;
        if (!restaurantId) {
            throw new Error('Unable to determine the restaurant for this order.');
        }

        const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
        const shippingFee = subtotal === 0 ? 0 : delivery_charges;
        const discount = getDiscountAmount(subtotal);
        const totalAmount = Math.max(0, subtotal + shippingFee - discount);
        const currencyCode = (currency || 'VND').trim() || 'VND';
        const paymentMethod = (paymentMethodOverride || method || 'cod').toLowerCase();
        const deliveryAddressSource = addressOverride || selectedAddress || null;
        const deliveryAddressSnapshot = deliveryAddressSource
            ? {
                id: deliveryAddressSource.id,
                label: deliveryAddressSource.label,
                recipient: deliveryAddressSource.recipient,
                phone: deliveryAddressSource.phone,
                street: deliveryAddressSource.street,
                ward: deliveryAddressSource.ward,
                district: deliveryAddressSource.district,
                city: deliveryAddressSource.city,
                instructions: deliveryAddressSource.instructions,
            }
            : null;

        const payload = {
            restaurant_id: restaurantId,
            items: orderItems,
            shipping_fee: shippingFee,
            discount,
            total_amount: totalAmount,
            currency: currencyCode,
            payment_method: paymentMethod,
            delivery_address: deliveryAddressSnapshot,
            metadata: {
                source: 'web-app',
                discount_code: appliedDiscountCode?.code || null,
            },
        };
        if (notes) {
            payload.metadata.notes = notes;
        }

        try {
            const createdOrder = await ordersService.createOrder(payload);
            const adapted = adaptOrderFromApi(createdOrder);
            if (!adapted) {
                throw new Error('The server responded without order data.');
            }
            try {
                await paymentsService.createPayment({
                    order_id: createdOrder.id,
                    user_id: user.id,
                    amount: totalAmount,
                    currency: currencyCode,
                    idempotency_key: `order-${createdOrder.id}`,
                });
            } catch (paymentError) {
                console.error('Failed to persist payment for order', paymentError);
                throw new Error(
                    paymentError?.response?.data?.error ||
                    'We created the order but could not record the payment. Please try again.'
                );
            }
            clearCart();
            setAppliedDiscountCode(null);
            await refreshOrders();
            return adapted;
        } catch (error) {
            const message =
                error?.response?.data?.error ||
                error?.message ||
                'Failed to place order. Please try again.';
            throw new Error(message);
        }
    }, [
        authToken,
        cartItems,
        products,
        delivery_charges,
        getDiscountAmount,
        currency,
        user,
        method,
        selectedAddress,
        appliedDiscountCode,
        clearCart,
        refreshOrders,
    ]);

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
        catalogLoading,
        catalogError,
        refreshCatalog,
        getRestaurantById,
        getDishesByRestaurant,
        getDishById,
        activeOrders,
        setActiveOrders,
        pastOrders,
        setPastOrders,
        ordersLoading,
        refreshOrders,
        placeOrder,
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
