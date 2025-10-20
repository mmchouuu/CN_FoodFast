// src/context/AppContext.jsx
import { useNavigate } from 'react-router-dom';
// import React, { createContext, useState, useContext, useEffect } from 'react';

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react'


import toast from 'react-hot-toast';
import catalogService from '../services/catalog';
import ordersService from '../services/orders';
import paymentsService from '../services/payments';
import { restaurantPlaceholderImage, dishPlaceholderImage } from '../utils/imageHelpers';

// --- Auth Systems ---
import authService from '../services/auth';
import {
    dishes as menuDishes,
    restaurants as restaurantList,
    notificationFeed,
    paymentOptions as paymentOptionList,
    restaurantReviews as initialRestaurantReviews,
} from '../data/customerData';


const AppContext = createContext();

const sanitizeUser = (rawUser) => {
    if (!rawUser) return null;
    const firstName = rawUser.first_name || rawUser.firstName || '';
    const lastName = rawUser.last_name || rawUser.lastName || '';
    const fullNameSource =
        rawUser.fullName ||
        rawUser.full_name ||
        [firstName, lastName].filter(Boolean).join(' ').trim();
    const resolvedFullName = fullNameSource || rawUser.email || 'FoodFast Customer';
    const phoneSource =
        rawUser.phone != null
            ? String(rawUser.phone).trim()
            : rawUser.phone_number != null
                ? String(rawUser.phone_number).trim()
                : '';

    return {
        id: rawUser.id,
        first_name: firstName || null,
        last_name: lastName || null,
        fullName: resolvedFullName,
        email: rawUser.email || rawUser.email_address || null,
        phone: phoneSource,
        role: rawUser.role,
        avatar: rawUser.avatar_url || rawUser.avatar || null,
    };
};

const FALLBACK_PRODUCTS = menuDishes;
const FALLBACK_RESTAURANTS = restaurantList;
const DEFAULT_PAYMENT_METHOD = paymentOptionList[0]?.id || 'wallet';
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

    const restaurantProductsRaw = Array.isArray(restaurant.products) ? restaurant.products : [];
    const restaurantProducts = restaurantProductsRaw
        .map((item) => adaptProductFromApi(item))
        .filter(Boolean);
    const popularIds = restaurantProducts.filter((item) => item.popular).map((item) => item._id);

    const branchList = Array.isArray(restaurant.branches)
        ? restaurant.branches.map((branch) => {
            const branchImages = ensureArray(branch.images).filter(Boolean);
            const addressParts = [branch.street, branch.ward, branch.district, branch.city]
                .filter(Boolean)
                .join(', ');
            const branchProductsRaw = Array.isArray(branch.products) ? branch.products : [];
            const branchProducts = branchProductsRaw
                .map((item) => {
                    const adapted = adaptProductFromApi(item);
                    if (item && typeof item.inventory === 'object') {
                        const inventoryQuantity = toNumberOr(item.inventory.quantity, null);
                        adapted.inventory = {
                            quantity: inventoryQuantity,
                            reserved: toNumberOr(item.inventory.reserved_qty, null),
                            branchId: item.inventory.branch_id || item.inventory.branchId || branch.id,
                        };
                        if (inventoryQuantity !== null) {
                            adapted.inStock = inventoryQuantity > 0;
                        }
                    }
                    adapted.branchId = branch.id;
                    return adapted;
                })
                .filter(Boolean);
            return {
                id: branch.id,
                name: branch.name || 'Branch',
                number: branch.branchNumber ?? branch.branch_number ?? null,
                address: addressParts || branch.street || '',
                isPrimary: branch.isPrimary ?? branch.is_primary ?? false,
                isOpen: branch.isOpen ?? branch.is_open ?? false,
                rating: branch.ratingSummary?.avgRating ?? branch.rating ?? null,
                ratingCount: branch.ratingSummary?.totalRatings ?? branch.ratingCount ?? null,
                phone: branch.branchPhone || branch.phone || null,
                email: branch.branchEmail || branch.email || null,
                images: branchImages.length ? branchImages : [restaurantPlaceholderImage],
                products: branchProducts,
            };
        })
        : [];

    return {
        id: restaurant.id,
        name: restaurant.name || 'Restaurant',
        description: restaurant.description || '',
        address: restaurant.address || restaurant.description || 'Information is updating.',
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
        mapHint: restaurant.cuisine || 'Updating',
        promotions: [],
        featuredDishIds: popularIds,
        categories: restaurant.cuisine ? [restaurant.cuisine] : [],
        products: restaurantProducts,
        branches: branchList,
        createdAt,
        updatedAt,
    };
};

const adaptProductFromApi = (product) => {
    if (!product) return null;
    const images = ensureArray(product.images).filter(Boolean);
    const basePrice = toNumberOr(product.base_price, 0);
    const priceWithTax = toNumberOr(product.price_with_tax, basePrice);

    const inventorySource =
        (product.inventory_summary && typeof product.inventory_summary === 'object')
            ? product.inventory_summary
            : (product.inventory && typeof product.inventory === 'object')
                ? product.inventory
                : null;

    const inventoryQuantity = inventorySource && inventorySource.quantity !== undefined
        ? toNumberOr(inventorySource.quantity, null)
        : null;
    const inventoryReserved = inventorySource && inventorySource.reserved_qty !== undefined
        ? toNumberOr(inventorySource.reserved_qty, null)
        : null;
    const inventoryBranchId = inventorySource
        ? (inventorySource.branch_id || inventorySource.branchId || null)
        : null;

    const inventory = inventorySource
        ? {
            quantity: inventoryQuantity,
            reserved: inventoryReserved,
            branchId: inventoryBranchId,
        }
        : null;

    const inStock =
        inventoryQuantity === null || inventoryQuantity === undefined
            ? true
            : inventoryQuantity > 0;

    const createdAt = product.created_at ? new Date(product.created_at).getTime() : undefined;
    const updatedAt = product.updated_at ? new Date(product.updated_at).getTime() : undefined;
    return {
        _id: product.id,
        restaurantId: product.restaurant_id,
        title: product.title || 'Product',
        description: product.description || '',
        category: product.category || 'General',
        type: product.type || 'Standard',
        spiceLevel: product.spice_level || 0,
        sizes: ['Standard'],
        price: { Standard: basePrice },
        basePrice,
        priceWithTax,
        images: images.length ? images : [dishPlaceholderImage],
        tags: product.popular ? ['Popular'] : [],
        popular: Boolean(product.popular),
        rating: toNumberOr(product.rating, 0),
        reviewCount: toNumberOr(product.review_count, 0),
        toppings: [],
        options: [],
        preparation: {
            prepMinutes: toNumberOr(product.prep_minutes, 5),
            cookMinutes: toNumberOr(product.cook_minutes, 15),
        },
        inventory,
        inStock,
        available: product.available !== false,
        createdAt,
        updatedAt,
    };
};

const adaptAddressFromApi = (address) => {
    if (!address) return null;
    const primaryFlag =
        address.isDefault ??
        address.is_default ??
        address.is_primary ??
        false;

    return {
        id: address.id,
        label: address.label || 'Address',
        recipient: address.recipient || '',
        phone: address.phone || '',
        street: address.street || '',
        ward: address.ward || '',
        district: address.district || '',
        city: address.city || '',
        instructions: address.instructions || '',
        isDefault: Boolean(primaryFlag),
        createdAt: address.createdAt || address.created_at || null,
        updatedAt: address.updatedAt || address.updated_at || null,
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
    const restaurantSnapshotsMap =
        metadata.restaurant_snapshots && typeof metadata.restaurant_snapshots === 'object'
            ? metadata.restaurant_snapshots
            : null;
    const restaurantNamesMap =
        metadata.restaurant_names && typeof metadata.restaurant_names === 'object'
            ? metadata.restaurant_names
            : null;
    let restaurantSnapshotMeta =
        metadata.restaurant_snapshot && typeof metadata.restaurant_snapshot === 'object'
            ? metadata.restaurant_snapshot
            : null;
    if (!restaurantSnapshotMeta && restaurantSnapshotsMap) {
        restaurantSnapshotMeta =
            restaurantSnapshotsMap[order.restaurant_id] ||
            restaurantSnapshotsMap[String(order.restaurant_id)] ||
            null;
    }

    const placedAt = order.created_at || metadata.placed_at || new Date().toISOString();
    const lowerStatus = (order.status || '').toLowerCase();
    const totalAmount = toNumberOr(pricing.total ?? order.total_amount, 0);
    const subtotal = toNumberOr(pricing.subtotal ?? order.total_amount, totalAmount);
    const shippingFee = toNumberOr(pricing.shipping_fee, 0);
    const discount = toNumberOr(pricing.discount, 0);
    const etaMinutes = toNumberOr(metadata.eta_minutes, 30);
    const paymentMethodRaw = typeof paymentMeta.method === 'string' ? paymentMeta.method : 'cod';
    const paymentMethod = paymentMethodRaw.toUpperCase();
    const restaurantName =
        restaurantSnapshotMeta?.name ||
        metadata.restaurant_name ||
        restaurantNamesMap?.[order.restaurant_id] ||
        restaurantNamesMap?.[String(order.restaurant_id)] ||
        null;
    const fallbackSnapshotFromMap =
        restaurantSnapshotsMap?.[order.restaurant_id] ||
        restaurantSnapshotsMap?.[String(order.restaurant_id)] ||
        null;
    const restaurantImage =
        restaurantSnapshotMeta?.heroImage ||
        restaurantSnapshotMeta?.image ||
        metadata.restaurant_image ||
        fallbackSnapshotFromMap?.heroImage ||
        fallbackSnapshotFromMap?.image ||
        restaurantPlaceholderImage;
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
        restaurantSnapshot: restaurantSnapshotMeta,
        restaurantName,
        restaurantImage,
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
                displayName:
                    item.product_snapshot?.title ||
                    item.product_snapshot?.name ||
                    null,
                displayImage:
                    item.product_snapshot?.image ||
                    (item.product_snapshot?.images && item.product_snapshot.images[0]) ||
                    null,
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
    const [addresses, setAddresses] = useState([]);

    const [bankAccounts, setBankAccounts] = useState([]);

    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const selectedAddress = useMemo(
        () => addresses.find(address => address.id === selectedAddressId) || null,
        [addresses, selectedAddressId]
    );
    const [restaurantReviews, setRestaurantReviews] = useState(initialRestaurantReviews);
    const [appliedDiscountCode, setAppliedDiscountCode] = useState(null);
    const [method, setMethod] = useState(DEFAULT_PAYMENT_METHOD);
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

    // --- Local auth (via API Gateway) ---
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'));
    const [authProfile, setAuthProfile] = useState(() => {
        try {
            const raw = JSON.parse(localStorage.getItem('auth_profile') || 'null');
            return sanitizeUser(raw);
        } catch {
            return null;
        }
    });
    const authProfileId = authProfile?.id || null;
    const [restaurantProfile, setRestaurantProfile] = useState(() => {
        try { return JSON.parse(localStorage.getItem('restaurant_profile') || 'null'); } catch { return null; }
    });

    const refreshAddresses = useCallback(async () => {
        if (!authToken && !authProfileId) {
            setAddresses([]);
            setSelectedAddressId(null);
            return [];
        }
        try {
            const data = await authService.listAddresses({ userId: authProfileId || undefined });
            const adapted = Array.isArray(data)
                ? data.map((item) => adaptAddressFromApi(item)).filter(Boolean)
                : [];
            setAddresses(adapted);
            if (adapted.length) {
                const defaultAddress = adapted.find((addr) => addr.isDefault) || adapted[0];
                setSelectedAddressId(defaultAddress.id);
            } else {
                setSelectedAddressId(null);
            }
            return adapted;
        } catch (error) {
            console.error('Failed to load addresses', error);
            setAddresses([]);
            setSelectedAddressId(null);
            return [];
        }
    }, [authToken, authProfileId]);

    const refreshBankAccounts = useCallback(async () => {
        const userId = authProfileId || undefined;
        if (!authToken && !userId) {
            setBankAccounts([]);
            return [];
        }
        try {
            const data = await paymentsService.listBankAccounts({ userId });
            const accounts = Array.isArray(data) ? data : [];
            setBankAccounts(accounts);
            return accounts;
        } catch (error) {
            console.error('Failed to load bank accounts', error);
            setBankAccounts([]);
            return [];
        }
    }, [authToken, authProfileId]);

    const linkBankAccount = useCallback(async (payload) => {
        const account = await paymentsService.linkBankAccount({
            ...payload,
            user_id: payload?.user_id || authProfileId || undefined,
        });
        setBankAccounts(prev => [account, ...prev.filter(item => item.id !== account.id)]);
        return account;
    }, [authProfileId]);


    const refreshOrders = useCallback(async () => {
        if (!authToken) {
            setActiveOrders([]);
            setPastOrders([]);
            return { cancelled: true };
        }

        setOrdersLoading(true);
        try {
            const data = await ordersService.list();
            const adapted = Array.isArray(data)
                ? data.map(adaptOrderFromApi).filter(Boolean)
                : [];
            const { active, past } = splitOrdersByStatus(adapted);
            setActiveOrders(active);
            setPastOrders(past);
            return { success: true, active, past };
        } catch (error) {
            console.error('Failed to load orders from order-service', error);
            setActiveOrders([]);
            setPastOrders([]);
            return { success: false, error };
        } finally {
            setOrdersLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        refreshOrders();
    }, [refreshOrders]);

    useEffect(() => {
        if (!authToken && !authProfileId) {
            setAddresses([]);
            setSelectedAddressId(null);
            return;
        }
        refreshAddresses();
    }, [authToken, authProfileId, refreshAddresses]);

    useEffect(() => {
        if (!authToken && !authProfileId) {
            setBankAccounts([]);
            return;
        }
        refreshBankAccounts();
    }, [authToken, authProfileId, refreshBankAccounts]);

    useEffect(() => {
        if (method === 'bank' && bankAccounts.length === 0) {
            const fallbackMethod =
                paymentOptionList.find(option => option.id !== 'bank')?.id || DEFAULT_PAYMENT_METHOD;
            if (fallbackMethod !== method) {
                setMethod(fallbackMethod);
            }
        }
    }, [method, bankAccounts.length]);

    // --- Unified user object ---

    const user = authProfile || null;

    const userFullName = useMemo(() => {
        if (!user) return null;
        if (user.fullName) return user.fullName;
        const nameParts = [user.first_name, user.last_name].filter(Boolean);
        if (nameParts.length) return nameParts.join(' ');
        if (user.name) return user.name;
        if (user.given_name || user.family_name) {
            return [user.given_name, user.family_name].filter(Boolean).join(' ');
        }
        if (user.username) return user.username;
        return null;
    }, [user]);

    const userPhoneNumber = useMemo(() => {
        return (
            user?.phone ||
            user?.phone_number ||
            user?.primaryPhone?.number ||
            ''
        );
    }, [user]);

    const normalizeAddressFromApi = useCallback((address) => {
        if (!address) return null;
        return {
            id: address.id,
            label: address.label || 'Home',
            recipient: address.recipient || userFullName || 'FoodFast Customer',
            phone: address.phone || userPhoneNumber || '',
            street: address.street || '',
            ward: address.ward || '',
            district: address.district || '',
            city: address.city || '',
            instructions: address.instructions || '',
            isDefault: Boolean(
                address.is_default ??
                address.isDefault ??
                address.is_primary ??
                address.isPrimary
            ),
        };
    }, [userFullName, userPhoneNumber]);

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
            throw new Error('Please sign in to place an order.');
        }
        if (!user?.id) {
            throw new Error('Unable to verify your account. Please sign in again.');
        }

        const orderItems = [];
        const restaurantStats = new Map();

        for (const itemId in cartItems) {
            const product = products.find((item) => item._id === itemId);
            if (!product) continue;
            const sizeMap = cartItems[itemId] || {};
            for (const sizeKey in sizeMap) {
                const quantity = sizeMap[sizeKey];
                if (quantity <= 0) continue;
                const unitPrice = product.price?.[sizeKey] ?? product.basePrice ?? 0;
                const totalPrice = unitPrice * quantity;
                const restaurantId = product.restaurantId || null;

                if (!restaurantId) {
                    throw new Error('One or more dishes are missing restaurant information. Please try again.');
                }

                const restaurantRecord =
                    restaurants.find((entry) => entry.id === restaurantId) ||
                    FALLBACK_RESTAURANTS.find((entry) => entry.id === restaurantId) ||
                    null;
                const resolvedRestaurantImage =
                    restaurantRecord?.heroImage ||
                    restaurantRecord?.coverImage ||
                    (Array.isArray(restaurantRecord?.images) ? restaurantRecord.images[0] : null) ||
                    restaurantPlaceholderImage;

                const existingStats = restaurantStats.get(restaurantId) || {
                    subtotal: 0,
                    itemCount: 0,
                    snapshot: restaurantRecord
                        ? {
                            id: restaurantRecord.id,
                            name: restaurantRecord.name,
                            heroImage: restaurantRecord.heroImage || restaurantRecord.coverImage || resolvedRestaurantImage,
                            image: resolvedRestaurantImage,
                        }
                        : {
                            id: restaurantId,
                            name: 'Restaurant',
                            heroImage: restaurantPlaceholderImage,
                            image: restaurantPlaceholderImage,
                        },
                };

                existingStats.subtotal += totalPrice;
                existingStats.itemCount += quantity;
                restaurantStats.set(restaurantId, existingStats);

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
                        restaurant_id: restaurantId,
                        restaurant_name: existingStats.snapshot?.name || restaurantRecord?.name || null,
                    },
                });
            }
        }

        if (!orderItems.length) {
            throw new Error('Your cart is currently empty.');
        }

        const restaurantIds = Array.from(restaurantStats.keys());
        if (!restaurantIds.length) {
            throw new Error('Unable to determine restaurant information for this order.');
        }

        const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
        const shippingFee = subtotal === 0 ? 0 : delivery_charges;
        const discount = getDiscountAmount(subtotal);
        const totalAmount = Math.max(0, subtotal + shippingFee - discount);
        const currencyCode = (currency || 'VND').trim() || 'VND';
        const paymentMethod = (paymentMethodOverride || method || 'cod').toLowerCase();
        const deliveryAddressSource = addressOverride || selectedAddress || null;
        if (!deliveryAddressSource || !deliveryAddressSource.id) {
            throw new Error('Bạn cần chọn hoặc tạo địa chỉ giao hàng trước khi đặt đơn.');
        }
        const normalizeAddressField = (value) => {
            if (typeof value === 'string') {
                const trimmed = value.trim();
                return trimmed.length ? trimmed : null;
            }
            return value ?? null;
        };
        const deliveryAddressSnapshot = {
            id: deliveryAddressSource.id,
            label: normalizeAddressField(deliveryAddressSource.label) || 'Home',
            recipient: normalizeAddressField(deliveryAddressSource.recipient),
            phone: normalizeAddressField(deliveryAddressSource.phone),
            street: normalizeAddressField(deliveryAddressSource.street),
            ward: normalizeAddressField(deliveryAddressSource.ward),
            district: normalizeAddressField(deliveryAddressSource.district),
            city: normalizeAddressField(deliveryAddressSource.city),
            instructions: normalizeAddressField(deliveryAddressSource.instructions),
        };
        if (!deliveryAddressSnapshot.street) {
            throw new Error('Địa chỉ giao hàng chưa đầy đủ. Vui lòng cập nhật lại.');
        }
        const deliveryAddressId = deliveryAddressSnapshot.id;

        const restaurantSnapshots = {};
        const pricingBreakdown = {};
        restaurantIds.forEach((restaurantId) => {
            const stats = restaurantStats.get(restaurantId);
            if (!stats) return;
            restaurantSnapshots[restaurantId] = stats.snapshot;
            pricingBreakdown[restaurantId] = {
                subtotal: stats.subtotal,
                item_count: stats.itemCount,
            };
        });

        const metadata = {
            source: 'web-app',
            discount_code: appliedDiscountCode?.code || null,
            restaurant_ids: restaurantIds,
            restaurant_snapshots: restaurantSnapshots,
            pricing_breakdown: pricingBreakdown,
            delivery_address_id: deliveryAddressId,
            delivery_address: deliveryAddressSnapshot,
        };
        if (restaurantIds.length === 1) {
            metadata.restaurant_snapshot = restaurantSnapshots[restaurantIds[0]];
        }
        if (notes) {
            metadata.notes = notes;
        }

        const payload = {
            items: orderItems,
            shipping_fee: shippingFee,
            discount,
            total_amount: totalAmount,
            currency: currencyCode,
            payment_method: paymentMethod,
            delivery_address: deliveryAddressSnapshot,
            delivery_address_id: deliveryAddressId,
            metadata,
        };
        if (restaurantIds.length === 1) {
            payload.restaurant_id = restaurantIds[0];
        }

        try {
            const createdOrder = await ordersService.createOrder(payload);
            const createdList = Array.isArray(createdOrder) ? createdOrder : [createdOrder];
            if (!createdList.length) {
                throw new Error('The server responded without order data.');
            }
            const adaptedList = createdList.map(adaptOrderFromApi).filter(Boolean);
            if (!adaptedList.length) {
                throw new Error('Unable to parse order data from server response.');
            }

            const recordPaymentsInBackground = async () => {
                const tasks = createdList.map(async (orderRecord, index) => {
                    try {
                        const paymentAmount = Number(orderRecord.total_amount) || adaptedList[index]?.totalAmount || 0;
                        const paymentPayload = {
                            order_id: orderRecord.id,
                            user_id: user.id,
                            amount: paymentAmount,
                            currency: currencyCode,
                            payment_method: paymentMethod,
                            idempotency_key: `order-${orderRecord.id}`,
                        };
                        const paymentRecord = await paymentsService.createPayment(paymentPayload);
                        if (paymentRecord?.status && adaptedList[index]) {
                            adaptedList[index].paymentStatus = paymentRecord.status;
                        }
                    } catch (paymentErr) {
                        const errorMsg =
                            paymentErr?.response?.data?.error ||
                            paymentErr?.message ||
                            'Không thể ghi nhận thanh toán cho đơn hàng.';
                        console.error('Failed to persist payment for order', paymentErr);
                        toast.error(errorMsg);
                    }
                });

                await Promise.allSettled(tasks);
                refreshOrders();
            };

            recordPaymentsInBackground().catch((err) => {
                console.error('Unexpected payment background error', err);
                toast.error('Không thể đồng bộ thanh toán. Vui lòng kiểm tra lại đơn hàng.');
            });

            clearCart();
            setAppliedDiscountCode(null);
            refreshOrders().catch((err) => {
                console.error('Failed to refresh orders after checkout', err);
            });
            return adaptedList.length === 1 ? adaptedList[0] : adaptedList;
        } catch (error) {
            const statusCode = error?.response?.status;
            if (statusCode === 401) {
                throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            }
            if (error?.code === 'ECONNABORTED') {
                throw new Error('Máy chủ phản hồi chậm. Vui lòng thử lại sau ít phút.');
            }
            const message =
                error?.response?.data?.error ||
                error?.message ||
                'Failed to place order. Please try again.';
            throw new Error(message);
        }
    }, [
        authToken,
        user,
        cartItems,
        products,
        delivery_charges,
        getDiscountAmount,
        currency,
        method,
        selectedAddress,
        appliedDiscountCode,
        restaurants,
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

    useEffect(() => {
        try {
            if (restaurantProfile) {
                localStorage.setItem('restaurant_profile', JSON.stringify(restaurantProfile));
            } else {
                localStorage.removeItem('restaurant_profile');
            }
        } catch (e) {
            // ignore persistence errors
        }
    }, [restaurantProfile]);

    // Persist local auth
    useEffect(() => {
        if (authToken) localStorage.setItem('auth_token', authToken); else localStorage.removeItem('auth_token');
    }, [authToken]);


    useEffect(() => {
        try {
            if (authProfile) localStorage.setItem('auth_profile', JSON.stringify(authProfile));
            else localStorage.removeItem('auth_profile');
        } catch { }
    }, [authProfile]);



    // --- Local auth actions ---
    const loginWithCredentials = async (email, password) => {
        try {
            const res = await authService.login(email, password);

            let sanitizedUser = null;
            if (res?.token) {
                setAuthToken(res.token);
                localStorage.setItem('auth_token', res.token);
            }
            if (res?.user) {
                sanitizedUser = sanitizeUser(res.user);
                setAuthProfile(sanitizedUser);
                localStorage.setItem('auth_profile', JSON.stringify(sanitizedUser));
            }
            toast.success(res?.message || 'Logged in successfully');
            try {
                const pendingRaw = localStorage.getItem('pending_address');
                if (pendingRaw) {
                    const addr = JSON.parse(pendingRaw);
                    const resolvedUserId =
                        addr?.user_id ||
                        res?.user?.id ||
                        sanitizedUser?.id ||
                        authProfileId;
                    if (resolvedUserId) {
                        addr.user_id = resolvedUserId;
                    }
                    localStorage.removeItem('pending_address');
                    localStorage.removeItem('pending_user_id');
                    await authService.createAddress(addr);
                    await refreshAddresses();
                    toast.success('Saved your pending address.');
                }
            } catch { }
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
        setAddresses([]);
        setSelectedAddressId(null);
        setBankAccounts([]);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_profile');
        localStorage.removeItem('pending_user_id');
        toast('Logged out');
    };

    const verifyOtp = async (email, otp) => {
        try {
            const res = await authService.verify(email, otp);
            let sanitizedUser = null;
            if (res?.token) {
                setAuthToken(res.token);
                localStorage.setItem('auth_token', res.token);
            }
            if (res?.user) {
                sanitizedUser = sanitizeUser(res.user);
                setAuthProfile(sanitizedUser);
                localStorage.setItem('auth_profile', JSON.stringify(sanitizedUser));
            }
            toast.success(res?.message || 'Verification successful.');
            try {
                const pending = localStorage.getItem('pending_address');
                if (pending) {
                    const addr = JSON.parse(pending);
                    const resolvedUserId =
                        addr?.user_id ||
                        res?.user?.id ||
                        sanitizedUser?.id ||
                        authProfileId;
                    if (resolvedUserId) {
                        addr.user_id = resolvedUserId;
                    }
                    localStorage.removeItem('pending_address');
                    localStorage.removeItem('pending_user_id');
                    await authService.createAddress(addr);
                    await refreshAddresses();
                    toast.success('Saved your pending address.');
                }
            } catch { }
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

    const getOrderById = useCallback(
        (orderId) => {
            if (!orderId) return null;
            const combined = [...activeOrders, ...pastOrders];
            return combined.find((order) => order.id === orderId) || null;
        },
        [activeOrders, pastOrders],
    );

    const fetchOrderById = useCallback(
        async (orderId) => {
            if (!authToken) {
                throw new Error('Please sign in to view order details.');
            }
            if (!orderId) {
                throw new Error('Order identifier is required.');
            }
            try {
                const data = await ordersService.get(orderId);
                const adapted = adaptOrderFromApi(data);
                if (!adapted) {
                    throw new Error('Order not found.');
                }
                return adapted;
            } catch (error) {
                const message =
                    error?.response?.data?.error ||
                    error?.message ||
                    'Failed to load order details.';
                throw new Error(message);
            }
        },
        [authToken],
    );

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


    const addNewAddress = async (address) => {
        const resolvedUserId = address.user_id || authProfileId;
        if (!resolvedUserId) {
            throw new Error('Missing user identifier for address creation');
        }
        const payload = {
            label: address.label,
            recipient: address.recipient,
            phone: address.phone,

            street: address.street,
            ward: address.ward,
            district: address.district,
            city: address.city,
            instructions: address.instructions,
            isDefault: address.isDefault,
            user_id: resolvedUserId,
        };
        const created = await authService.createAddress(payload);
        const adapted = adaptAddressFromApi(created);
        await refreshAddresses();
        return adapted;
    };

    const updateAddress = (addressId, updates) => {
        setAddresses(prev =>
            prev.map(address =>
                address.id === addressId ? { ...address, ...updates } : address
            )
        );
    };

    const removeAddress = async (addressId) => {
        await authService.deleteAddress(addressId, { userId: authProfileId || undefined });
        await refreshAddresses();
    };


    const updateLocalProfile = (updates) => {
        setAuthProfile(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...updates };
            if (!updates?.fullName) {
                const mergedFirst = updates?.first_name ?? updated.first_name;
                const mergedLast = updates?.last_name ?? updated.last_name;
                const combined = [mergedFirst, mergedLast].filter(Boolean).join(' ').trim();
                if (combined) {
                    updated.fullName = combined;
                }
            } else if (!updated.fullName) {
                const combined = [updated.first_name, updated.last_name].filter(Boolean).join(' ').trim();
                if (combined) {
                    updated.fullName = combined;
                }
            }
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
        getOrderById,
        fetchOrderById,
        placeOrder,
        addresses,
        selectedAddress,
        selectedAddressId,
        setSelectedAddressId,
        refreshAddresses,
        addNewAddress,
        updateAddress,
        removeAddress,
        applyDiscountCode,
        appliedDiscountCode,
        notifications,
        markNotificationAsRead,
        clearCart,
        bankAccounts,
        refreshBankAccounts,
        linkBankAccount,
        paymentOptions: paymentOptionList,
        restaurantReviews,
        addRestaurantReview,
        getReviewsForRestaurant,
        getRestaurantRatingSummary,
        updateLocalProfile,
        restaurantProfile,
        setRestaurantProfile,

        // Auth Actions
        isAuthenticated: Boolean(user),
        // Local auth
        loginWithCredentials,
        signupWithCredentials,
        requestPasswordReset,
        logoutLocal,
        verifyOtp,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);



