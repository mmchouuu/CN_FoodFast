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
const CARD_STORAGE_KEY = 'customer_payment_cards';

const toNumberOr = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const generateCardId = () => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (error) {
        // ignore generation errors, fallback below
    }
    return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const readStoredCardsMap = () => {
    if (typeof window === 'undefined') {
        return {};
    }
    try {
        const raw = localStorage.getItem(CARD_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Failed to parse stored cards', error);
        return {};
    }
};

const loadCardsForUser = (userId) => {
    if (!userId) return [];
    const map = readStoredCardsMap();
    const list = map?.[userId];
    return Array.isArray(list) ? list : [];
};

const persistCardsForUser = (userId, cards) => {
    if (!userId || typeof window === 'undefined') {
        return;
    }
    try {
        const map = readStoredCardsMap();
        map[userId] = cards;
        localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
        console.warn('Failed to persist stored cards', error);
    }
};

const detectCardBrand = (digitString = '') => {
    if (!digitString) return 'card';
    const digits = digitString.replace(/\D/g, '');
    if (!digits) return 'card';
    if (digits.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(digits)) return 'mastercard';
    if (/^3[47]/.test(digits)) return 'amex';
    if (digits.startsWith('6')) return 'discover';
    return 'card';
};

const adaptOptionValueFromApi = (item) => {
    if (!item) return null;
    const priceDelta =
        item.price_delta !== undefined && item.price_delta !== null
            ? toNumberOr(item.price_delta, 0)
            : item.priceDelta !== undefined && item.priceDelta !== null
                ? toNumberOr(item.priceDelta, 0)
                : 0;
    const branchOverrides = Array.isArray(item.branch_overrides)
        ? item.branch_overrides.map((override) => ({
            branchId: override.branch_id || override.branchId || null,
            branchProductId: override.branch_product_id || override.branchProductId || null,
            isAvailable:
                override.is_available !== undefined && override.is_available !== null
                    ? override.is_available !== false
                    : override.is_active !== false,
            isVisible:
                override.is_visible !== undefined && override.is_visible !== null
                    ? override.is_visible !== false
                    : override.is_active !== false,
            priceDelta:
                override.price_delta_override !== undefined && override.price_delta_override !== null
                    ? toNumberOr(override.price_delta_override, null)
                    : override.price_delta !== undefined && override.price_delta !== null
                        ? toNumberOr(override.price_delta, null)
                        : null,
        }))
        : [];
    const label = item.name || item.label || 'Option';
    return {
        id: item.id,
        label,
        name: label,
        description: item.description || '',
        priceDelta,
        branchOverrides,
    };
};

const adaptOptionGroupFromApi = (group) => {
    if (!group) return null;
    const selectionTypeRaw = group.selection_type || group.selectionType || 'multiple';
    const selectionType =
        typeof selectionTypeRaw === 'string' && selectionTypeRaw.toLowerCase() === 'single'
            ? 'single'
            : 'multiple';
    const minRaw =
        group.min_select !== undefined && group.min_select !== null
            ? group.min_select
            : group.minSelect;
    const maxRaw =
        group.max_select !== undefined && group.max_select !== null
            ? group.max_select
            : group.maxSelect;
    const minSelect =
        minRaw === undefined || minRaw === null
            ? selectionType === 'single'
                ? 1
                : 0
            : toNumberOr(minRaw, 0);
    const maxSelect =
        maxRaw === undefined || maxRaw === null
            ? selectionType === 'single'
                ? 1
                : null
            : toNumberOr(maxRaw, null);
    const values = Array.isArray(group.items)
        ? group.items.map(adaptOptionValueFromApi).filter(Boolean)
        : [];
    const label = group.name || group.label || 'Customization';
    const required =
        group.is_required !== undefined && group.is_required !== null
            ? Boolean(group.is_required)
            : group.isRequired !== undefined && group.isRequired !== null
                ? Boolean(group.isRequired)
                : minSelect > 0;
    return {
        id: group.id,
        name: label,
        label,
        description: group.description || '',
        type: selectionType,
        minSelect,
        maxSelect,
        required,
        values,
    };
};

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
            const rawBranchImages = ensureArray(branch.images);
            const branchImages = rawBranchImages.filter(Boolean);
            const branchLogoFallback = ensureArray(restaurant.logo).filter(Boolean);
            const displayImages = branchImages.length
                ? branchImages
                : branchLogoFallback.length
                    ? branchLogoFallback
                    : images;
            const branchHeroImage = displayImages[0] || heroImage;
            const branchCoverImage = displayImages[1] || branchHeroImage;

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
                    adapted.restaurantId = branch.id;
                    adapted.brandRestaurantId = restaurant.id;
                    adapted.brandName = restaurant.name || null;
                    adapted.branchName = branch.name || restaurant.name || null;
                    return adapted;
                })
                .filter(Boolean);

            const branchCategoriesRaw = Array.isArray(branch.categories) ? branch.categories : [];
            const branchCategoryNames = branchCategoriesRaw
                .map((category) => {
                    if (!category) return null;
                    if (typeof category === 'string') return category;
                    return category.name || category.label || null;
                })
                .filter(Boolean);

            const branchCombos = Array.isArray(branch.combos) ? branch.combos : [];

            return {
                id: branch.id,
                name: branch.name || restaurant.name || 'Branch',
                number: branch.branchNumber ?? branch.branch_number ?? null,
                address: addressParts || branch.street || '',
                isPrimary: branch.isPrimary ?? branch.is_primary ?? false,
                isOpen: branch.isOpen ?? branch.is_open ?? false,
                rating: branch.ratingSummary?.avgRating ?? branch.rating ?? null,
                ratingCount: branch.ratingSummary?.totalRatings ?? branch.ratingCount ?? null,
                phone: branch.branchPhone || branch.phone || null,
                email: branch.branchEmail || branch.email || null,
                images: displayImages.length ? displayImages : [restaurantPlaceholderImage],
                heroImage: branchHeroImage,
                coverImage: branchCoverImage,
                products: branchProducts,
                categories: branchCategoryNames,
                categoryAssignments: branchCategoriesRaw,
                combos: branchCombos,
                tags: Array.from(new Set([restaurant.cuisine, ...branchCategoryNames].filter(Boolean))),
                distanceKm: toNumberOr(branch.distance_km, toNumberOr(restaurant.distance_km, 0)),
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
    const taxAmount = Math.max(priceWithTax - basePrice, 0);
    const taxRate = basePrice > 0 ? taxAmount / basePrice : 0;

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

    const optionGroups = Array.isArray(product.options)
        ? product.options.map(adaptOptionGroupFromApi).filter(Boolean)
        : [];

    const sizeGroup = optionGroups.find((group) => {
        const name = (group.name || group.label || '').toLowerCase();
        if (name.includes('size')) return true;
        if (group.type === 'single' && (group.maxSelect === 1 || group.maxSelect == null)) {
            return name.includes('portion') || name.includes('serve') || name.includes('bowl');
        }
        return false;
    });

    let sizes = ['Standard'];
    let priceMap = { Standard: basePrice };

    if (sizeGroup && Array.isArray(sizeGroup.values) && sizeGroup.values.length) {
        const nextSizes = [];
        const nextPriceMap = {};
        sizeGroup.values.forEach((value) => {
            const label = (value.label || value.name || '').trim();
            if (!label) return;
            const delta = Number(value.priceDelta || 0);
            const computed = basePrice + (Number.isFinite(delta) ? delta : 0);
            nextSizes.push(label);
            nextPriceMap[label] = computed;
        });
        if (nextSizes.length) {
            sizes = nextSizes;
            priceMap = nextPriceMap;
        }
    }

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
        sizes,
        price: priceMap,
        basePrice,
        priceWithTax,
        taxRate,
        images: images.length ? images : [dishPlaceholderImage],
        tags: product.popular ? ['Popular'] : [],
        popular: Boolean(product.popular),
        rating: toNumberOr(product.rating, 0),
        reviewCount: toNumberOr(product.review_count, 0),
        toppings: [],
        options: optionGroups,
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

function buildBranchCatalog(brands = []) {
    const branches = [];
    const branchProducts = [];

    brands.forEach((brand) => {
        const branchList = Array.isArray(brand.branches) ? brand.branches : [];
        branchList.forEach((branch) => {
            let productsForBranch = Array.isArray(branch.products)
                ? branch.products.map((product) => ({
                    ...product,
                    restaurantId: branch.id,
                    branchId: branch.id,
                    brandRestaurantId: brand.id,
                    brandName: brand.name,
                    cuisine: brand.cuisine,
                }))
                : [];

            if (!productsForBranch.length && Array.isArray(brand.products) && brand.products.length) {
                productsForBranch = brand.products.map((product) => ({
                    ...product,
                    restaurantId: branch.id,
                    branchId: branch.id,
                    brandRestaurantId: brand.id,
                    brandName: brand.name,
                    cuisine: brand.cuisine,
                }));
            }

            branchProducts.push(...productsForBranch);

            const priceCandidates = productsForBranch
                .map((item) => toNumberOr(item.basePrice ?? item.base_price, 0))
                .filter((value) => Number.isFinite(value) && value >= 0);
            const priceRange = {
                min: priceCandidates.length ? Math.min(...priceCandidates) : 0,
                max: priceCandidates.length ? Math.max(...priceCandidates) : 0,
            };

            const branchCategories = Array.isArray(branch.categories) && branch.categories.length
                ? branch.categories
                : Array.isArray(brand.categories)
                    ? brand.categories
                    : [];

            const tagSet = new Set(
                [
                    brand.cuisine,
                    ...(Array.isArray(branch.tags) ? branch.tags : []),
                    ...branchCategories,
                ].filter(Boolean),
            );

            const displayImages = Array.isArray(branch.images) && branch.images.length
                ? branch.images
                : Array.isArray(brand.images) && brand.images.length
                    ? brand.images
                    : Array.isArray(brand.logo) && brand.logo.length
                        ? brand.logo
                        : [restaurantPlaceholderImage];

            branches.push({
                ...branch,
                id: branch.id,
                branchId: branch.id,
                restaurantId: branch.id,
                name: branch.name || brand.name || 'Restaurant',
                displayName: branch.name ? `${brand.name} • ${branch.name}` : brand.name,
                description: branch.description || brand.description || '',
                cuisine: brand.cuisine,
                tags: Array.from(tagSet),
                heroImage: branch.heroImage || brand.heroImage,
                coverImage: branch.coverImage || brand.coverImage,
                images: displayImages,
                logo: Array.isArray(brand.logo) ? brand.logo : [],
                distanceKm: toNumberOr(branch.distanceKm, toNumberOr(brand.distanceKm, 0)),
                rating: toNumberOr(branch.rating, brand.rating),
                reviewCount: toNumberOr(branch.ratingCount, brand.reviewCount),
                categories: branchCategories,
                categoryAssignments: branch.categoryAssignments || [],
                combos: Array.isArray(branch.combos) ? branch.combos : [],
                products: productsForBranch,
                priceRange,
                brand: {
                    id: brand.id,
                    name: brand.name,
                    cuisine: brand.cuisine,
                    phone: brand.phone,
                    email: brand.email,
                    images: brand.images,
                    logo: brand.logo,
                    description: brand.description,
                },
            });
        });
    });

    return { branches, branchProducts };
}

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

export const adaptOrderFromApi = (order) => {
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

    const branchSnapshotsMap =
        metadata.branch_snapshots && typeof metadata.branch_snapshots === 'object'
            ? metadata.branch_snapshots
            : null;
    const branchNamesMap =
        metadata.branch_names && typeof metadata.branch_names === 'object'
            ? metadata.branch_names
            : null;
    let branchSnapshotMeta =
        metadata.branch_snapshot && typeof metadata.branch_snapshot === 'object'
            ? metadata.branch_snapshot
            : null;
    if (!branchSnapshotMeta && branchSnapshotsMap) {
        branchSnapshotMeta =
            branchSnapshotsMap[order.branch_id] ||
            branchSnapshotsMap[String(order.branch_id)] ||
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
    const branchName =
        branchSnapshotMeta?.displayName ||
        branchSnapshotMeta?.name ||
        metadata.branch_name ||
        branchNamesMap?.[order.branch_id] ||
        branchNamesMap?.[String(order.branch_id)] ||
        null;
    const branchImage =
        branchSnapshotMeta?.heroImage ||
        branchSnapshotMeta?.image ||
        null;
    const restaurantDisplayName =
        branchSnapshotMeta?.displayName ||
        (branchName && restaurantName ? `${restaurantName} • ${branchName}` : restaurantName);
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
        restaurantDisplayName,
        restaurantImage,
        branchId: order.branch_id,
        branchName,
        branchImage,
        branchSnapshot: branchSnapshotMeta,
        branchAddress: branchSnapshotMeta?.address || null,
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
    const [restaurantBrands, setRestaurantBrands] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState(null);
    const [activeOrders, setActiveOrders] = useState([]);
    const [pastOrders, setPastOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [notifications, setNotifications] = useState(notificationFeed);
    const [addresses, setAddresses] = useState([]);

    const [bankAccounts, setBankAccounts] = useState([]);
    const [cardAccounts, setCardAccounts] = useState([]);
    const [customerProfileOpen, setCustomerProfileOpen] = useState(false);

    const openCustomerProfilePanel = useCallback(() => setCustomerProfileOpen(true), []);
    const closeCustomerProfilePanel = useCallback(() => setCustomerProfileOpen(false), []);

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
    const [cartItemDetails, setCartItemDetails] = useState({});
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

            const { branches: flattenedBranches, branchProducts } = buildBranchCatalog(adaptedRestaurants);

            const globalProducts = Array.isArray(productData)
                ? productData.map(adaptProductFromApi).filter(Boolean)
                : [];

            setRestaurantBrands(adaptedRestaurants);
            setRestaurants(flattenedBranches);
            setProducts(branchProducts.length ? branchProducts : globalProducts);

            return { success: true };
        } catch (error) {
            if (signal?.aborted) {
                return { cancelled: true };
            }
            console.error('Failed to load catalog data from product-service', error);
            setCatalogError(error?.message || 'Unable to load restaurant catalog.');

            const fallbackBrands = FALLBACK_RESTAURANTS
                .map(adaptRestaurantFromApi)
                .filter(Boolean);
            const { branches: fallbackBranchesRaw, branchProducts: fallbackBranchProductsRaw } =
                buildBranchCatalog(fallbackBrands);

            const safeFallbackBranches = fallbackBranchesRaw.length
                ? fallbackBranchesRaw
                : fallbackBrands.map((brand) => {
                    const fallbackBranchProducts = Array.isArray(brand.products)
                        ? brand.products.map((product) => ({
                            ...product,
                            restaurantId: brand.id,
                            branchId: brand.id,
                            brandRestaurantId: brand.id,
                            brandName: brand.name,
                        }))
                        : [];
                    return {
                        id: brand.id,
                        branchId: brand.id,
                        restaurantId: brand.id,
                        name: brand.name,
                        displayName: brand.name,
                        description: brand.description || '',
                        cuisine: brand.cuisine,
                        tags: Array.isArray(brand.tags) ? brand.tags : brand.cuisine ? [brand.cuisine] : [],
                        heroImage: brand.heroImage,
                        coverImage: brand.coverImage,
                        images: brand.images,
                        logo: brand.logo,
                        distanceKm: brand.distanceKm ?? 0,
                        rating: brand.rating ?? 0,
                        reviewCount: brand.reviewCount ?? 0,
                        categories: Array.isArray(brand.categories) ? brand.categories : [],
                        categoryAssignments: [],
                        combos: [],
                        products: fallbackBranchProducts,
                        priceRange: { min: 0, max: 0 },
                        brand: {
                            id: brand.id,
                            name: brand.name,
                            cuisine: brand.cuisine,
                            phone: brand.phone,
                            email: brand.email,
                            images: brand.images,
                            logo: brand.logo,
                            description: brand.description,
                        },
                    };
                });

            const safeFallbackProducts = fallbackBranchProductsRaw.length
                ? fallbackBranchProductsRaw
                : safeFallbackBranches.flatMap((branch) => branch.products || []);

            setRestaurantBrands((prev) => (prev.length ? prev : fallbackBrands));
            setRestaurants((prev) => (prev.length ? prev : safeFallbackBranches));
            setProducts((prev) => (prev.length ? prev : safeFallbackProducts.length ? safeFallbackProducts : FALLBACK_PRODUCTS));
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

    useEffect(() => {
        if (!authProfileId) {
            setCardAccounts([]);
            return;
        }
        setCardAccounts(loadCardsForUser(authProfileId));
    }, [authProfileId]);

    const refreshOrders = useCallback(async () => {
        if (!authToken) {
            setActiveOrders([]);
            setPastOrders([]);
            setOrdersLoading(false);
            return { success: false, reason: 'unauthenticated' };
        }

        setOrdersLoading(true);
        try {
            const response = await ordersService.list();
            const rawList = Array.isArray(response)
                ? response
                : Array.isArray(response?.orders)
                    ? response.orders
                    : Array.isArray(response?.data)
                        ? response.data
                        : [];
            const adapted = rawList.map(adaptOrderFromApi).filter(Boolean);
            const { active, past } = splitOrdersByStatus(adapted);
            setActiveOrders(active);
            setPastOrders(past);
            return { success: true, active, past };
        } catch (error) {
            console.error('Failed to refresh orders', error);
            setActiveOrders([]);
            setPastOrders([]);
            return { success: false, error };
        } finally {
            setOrdersLoading(false);
        }
    }, [authToken]);

    const refreshAddresses = useCallback(async () => {
        if (!authToken && !authProfileId) {
            setAddresses([]);
            setSelectedAddressId(null);
            return [];
        }
        try {
            const data = await authService.listAddresses({ userId: authProfileId || undefined });
            const rawList = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : Array.isArray(data?.addresses)
                        ? data.addresses
                        : [];
            const adapted = rawList.map(adaptAddressFromApi).filter(Boolean);
            setAddresses(adapted);
            if (adapted.length) {
                const defaultAddress = adapted.find((addr) => addr.isDefault) || adapted[0];
                setSelectedAddressId(defaultAddress.id);
            } else {
                setSelectedAddressId(null);
            }
            return adapted;
        } catch (error) {
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
                setAddresses([]);
                setSelectedAddressId(null);
                return [];
            }
            console.error('Failed to load addresses', error);
            toast.error('Unable to load saved addresses. Please try again later.');
            return [];
        }
    }, [authToken, authProfileId]);

    const refreshBankAccounts = useCallback(async () => {
        if (!authToken && !authProfileId) {
            setBankAccounts([]);
            return [];
        }
        try {
            const data = await paymentsService.listBankAccounts({ userId: authProfileId || undefined });
            const rawList = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : Array.isArray(data?.items)
                        ? data.items
                        : [];
            setBankAccounts(rawList);
            return rawList;
        } catch (error) {
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
                setBankAccounts([]);
                return [];
            }
            const errorMessage = String(error?.response?.data?.message || '').toLowerCase();
            if (
                status === 404 ||
                status === 400 ||
                error?.response?.data?.code === 'BANK_ACCOUNT_NOT_FOUND' ||
                errorMessage.includes('not linked') ||
                errorMessage.includes('no bank account')
            ) {
                setBankAccounts([]);
                return [];
            }
            console.error('Failed to load bank accounts', error);
            toast.error('Unable to load bank accounts. Please try again later.');
            setBankAccounts([]);
            return [];
        }
    }, [authToken, authProfileId]);

    const linkBankAccount = useCallback(
        async (payload = {}) => {
            if (!authToken && !authProfileId) {
                throw new Error('Please sign in to link a bank account.');
            }
            const requestPayload = { ...payload };
            if (!requestPayload.user_id && authProfileId) {
                requestPayload.user_id = authProfileId;
            }
            const record = await paymentsService.linkBankAccount(requestPayload);
            await refreshBankAccounts();
            return record;
        },
        [authToken, authProfileId, refreshBankAccounts],
    );

    const linkPaymentCard = useCallback(
        async (payload = {}) => {
            if (!authProfileId) {
                throw new Error('Please sign in to link a card.');
            }
            const rawNumber = String(payload.cardNumber || '').replace(/\D/g, '');
            if (!rawNumber || rawNumber.length < 4) {
                throw new Error('Please provide a valid card number.');
            }
            const normalizedMonth = payload.expiryMonth ? String(payload.expiryMonth).padStart(2, '0') : '';
            const normalizedYear = payload.expiryYear ? String(payload.expiryYear).padStart(2, '0') : '';
            const cardRecord = {
                id: payload.id || generateCardId(),
                cardholderName: (payload.cardholderName || '').trim(),
                last4: rawNumber.slice(-4),
                expiryMonth: normalizedMonth,
                expiryYear: normalizedYear,
                brand: detectCardBrand(rawNumber),
                isDefault: Boolean(payload.isDefault),
            };
            setCardAccounts((prev) => {
                const filtered = prev.filter((card) => card.id !== cardRecord.id);
                const updated = cardRecord.isDefault
                    ? [
                        cardRecord,
                        ...filtered.map((card) => ({ ...card, isDefault: false })),
                    ]
                    : [...filtered, cardRecord];
                persistCardsForUser(authProfileId, updated);
                return updated;
            });
            return cardRecord;
        },
        [authProfileId],
    );

    const removePaymentCard = useCallback(
        (cardId) => {
            if (!authProfileId) {
                return;
            }
            setCardAccounts((prev) => {
                const updated = prev.filter((card) => card.id !== cardId);
                persistCardsForUser(authProfileId, updated);
                return updated;
            });
        },
        [authProfileId],
    );

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
            setMethod(DEFAULT_PAYMENT_METHOD);
            return;
        }
        if (method === 'card' && cardAccounts.length === 0) {
            setMethod(DEFAULT_PAYMENT_METHOD);
        }
    }, [method, bankAccounts.length, cardAccounts.length, setMethod]);

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
    const generateCartSignature = (value) => (value ? String(value) : 'base');

    const resolveCartKey = (sizeLabel, signature = 'base') => {
        const normalizedSize = (sizeLabel || 'Standard').replace(/::/g, '--');
        const normalizedSignature = generateCartSignature(signature).replace(/::/g, '--');
        return `${normalizedSize}::${normalizedSignature}`;
    };

    const buildDetailKey = (productId, cartKey) => `${productId}:${cartKey}`;

    const addToCart = (reference, maybeSize, maybeQuantity = 1, config = {}) => {
        const payload = typeof reference === 'object' && reference !== null
            ? reference
            : {
                productId: reference,
                size: maybeSize,
                quantity: maybeQuantity,
                ...config,
            };

        const {
            productId,
            size,
            quantity = 1,
            signature,
            options = [],
            basePrice: providedBasePrice,
            sizePriceDelta: providedSizeDelta,
            optionPriceTotal: providedOptionTotal,
            subtotal: providedSubtotal,
            taxRate: providedTaxRate,
            taxAmount: providedTaxAmount,
            unitPrice: providedUnitPrice,
        } = payload;

        const product = products.find((item) => item._id === productId);
        if (!product) {
            toast.error('Dish not found.');
            return;
        }

        if (product.sizes?.length && !size && !payload.sizeOptional) {
            toast.error('Please choose a size before adding this dish.');
            return;
        }

        const sizeLabel = size || product.sizes?.[0] || 'Standard';
        const cartSignature = signature || generateCartSignature(
            options
                .flatMap((group) => group.values || [])
                .map((value) => value.id || value.label)
                .sort()
                .join('|'),
        );
        const cartKey = resolveCartKey(sizeLabel, cartSignature);
        const detailKey = buildDetailKey(productId, cartKey);

        const basePriceCandidate =
            providedBasePrice ??
            product.basePrice ??
            product.price?.Standard ??
            product.price?.[sizeLabel] ??
            0;

        const sizePriceDelta =
            providedSizeDelta ??
            (() => {
                const sizeSpecificPrice = product.price?.[sizeLabel];
                if (
                    typeof sizeSpecificPrice === 'number' &&
                    typeof basePriceCandidate === 'number'
                ) {
                    return sizeSpecificPrice - basePriceCandidate;
                }
                return 0;
            })();
        const optionPriceTotal = providedOptionTotal ?? 0;

        const subtotal =
            providedSubtotal ?? basePriceCandidate + sizePriceDelta + optionPriceTotal;

        const taxRate = providedTaxRate ?? product.taxRate ?? 0;
        const taxAmount =
            providedTaxAmount ?? (taxRate > 0 ? subtotal * taxRate : 0);
        const unitPrice =
            providedUnitPrice ?? Math.max(subtotal + taxAmount, 0);

        setCartItems((prev) => {
            const updated = structuredClone(prev);
            updated[productId] = updated[productId] || {};
            updated[productId][cartKey] =
                (updated[productId][cartKey] || 0) + Math.max(quantity, 1);
            return updated;
        });

        const resolvedBranchId =
            product.branchId ??
            product.inventory?.branchId ??
            product.restaurantBranchId ??
            product.restaurant_id ??
            product.restaurantId ??
            null;
        const resolvedBrandRestaurantId =
            product.brandRestaurantId ??
            product.brandRestaurantID ??
            product.brand?.id ??
            product.brandId ??
            product.restaurant_brand_id ??
            null;
        const branchRecord = resolvedBranchId
            ? restaurants.find((entry) => entry.id === resolvedBranchId)
            : null;
        const brandRecord =
            resolvedBrandRestaurantId
                ? restaurantBrands.find((entry) => entry.id === resolvedBrandRestaurantId)
                : branchRecord?.brand || null;
        const branchDisplayName =
            branchRecord?.displayName ||
            branchRecord?.name ||
            product.branchName ||
            product.restaurantName ||
            (brandRecord?.name && branchRecord?.name
                ? `${brandRecord.name} • ${branchRecord.name}`
                : null);
        const branchAddress =
            branchRecord?.address ||
            [branchRecord?.street, branchRecord?.ward, branchRecord?.district, branchRecord?.city]
                .filter(Boolean)
                .join(', ');
        const branchHeroImage =
            branchRecord?.heroImage ||
            (Array.isArray(branchRecord?.images) ? branchRecord.images[0] : null) ||
            null;
        const brandDisplayName = brandRecord?.name || product.brandName || branchDisplayName || 'Restaurant';

        setCartItemDetails((prev) => ({
            ...prev,
            [detailKey]: {
                displaySize: sizeLabel,
                signature: cartSignature,
                options,
                basePrice: basePriceCandidate,
                sizePriceDelta,
                optionPriceTotal,
                subtotal,
                taxRate,
                taxAmount,
                unitPrice,
                branchId: resolvedBranchId,
                branchName: branchDisplayName || brandDisplayName,
                branchAddress: branchAddress || '',
                branchImage: branchHeroImage,
                branchProductId:
                    product.branch_product_id ||
                    product.branchProductId ||
                    product.inventory?.branch_product_id ||
                    product.inventory?.branchProductId ||
                    null,
                brandRestaurantId: resolvedBrandRestaurantId || resolvedBranchId || null,
                brandRestaurantName: brandDisplayName,
            },
        }));

        toast.success(`${product.title} was added to your cart.`);
    };

    const getCartCount = () =>
        Object.values(cartItems).reduce(
            (count, sizeMap) =>
                count +
                Object.values(sizeMap).reduce(
                    (sum, qty) => sum + qty,
                    0,
                ),
            0,
        );

    const updateQuantity = (productId, cartKey, quantity) => {
        setCartItems((prev) => {
            const updated = structuredClone(prev);
            if (!updated[productId]) {
                return prev;
            }
            if (quantity <= 0) {
                delete updated[productId][cartKey];
                if (Object.keys(updated[productId]).length === 0) {
                    delete updated[productId];
                }
                setCartItemDetails((detailPrev) => {
                    const next = { ...detailPrev };
                    delete next[buildDetailKey(productId, cartKey)];
                    return next;
                });
            } else {
                updated[productId][cartKey] = quantity;
            }
            return updated;
        });
    };

    const getCartAmount = () => {
        let total = 0;
        for (const itemId in cartItems) {
            const sizeMap = cartItems[itemId] || {};
            for (const cartKey in sizeMap) {
                const quantity = sizeMap[cartKey];
                if (quantity <= 0) continue;
                const detail = cartItemDetails[buildDetailKey(itemId, cartKey)];
                if (detail?.unitPrice != null) {
                    total += detail.unitPrice * quantity;
                    continue;
                }
                const product = products.find((p) => p._id === itemId);
                if (!product) continue;
                const [sizeLabel] = cartKey.split('::');
                const fallbackPrice =
                    product.price?.[sizeLabel] ??
                    product.basePrice ??
                    product.price?.Standard ??
                    0;
                total += fallbackPrice * quantity;
            }
        }
        return total;
    };

    const clearCart = () => {
        setCartItems({});
        setCartItemDetails({});
    };

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
        const branchStats = new Map();

        for (const itemId in cartItems) {
            const product = products.find((item) => item._id === itemId);
            if (!product) continue;
            const sizeMap = cartItems[itemId] || {};
            for (const cartKey in sizeMap) {
                const quantity = sizeMap[cartKey];
                if (quantity <= 0) continue;

                const detail = cartItemDetails[buildDetailKey(itemId, cartKey)] || null;
                const [rawSizeLabel] = cartKey.split('::');
                const displaySize = detail?.displaySize || rawSizeLabel || 'Standard';
                const baseUnitPrice =
                    detail?.unitPrice ??
                    product.price?.[displaySize] ??
                    product.basePrice ??
                    product.price?.Standard ??
                    0;
                const subtotalPerUnit =
                    detail?.subtotal ??
                    (baseUnitPrice - (detail?.taxAmount ?? 0));
                const taxPerUnit = detail?.taxAmount ?? 0;
                const unitPrice = Math.max(baseUnitPrice, 0);
                const totalPrice = unitPrice * quantity;
                const branchId =
                    detail?.branchId ??
                    product.branchId ??
                    product.inventory?.branchId ??
                    product.restaurantBranchId ??
                    product.restaurantId ??
                    null;
                const branchProductId =
                    detail?.branchProductId ??
                    product.branch_product_id ??
                    product.branchProductId ??
                    product.inventory?.branch_product_id ??
                    product.inventory?.branchProductId ??
                    null;
                const brandRestaurantId =
                    detail?.brandRestaurantId ??
                    product.brandRestaurantId ??
                    product.brandRestaurantID ??
                    product.restaurant_brand_id ??
                    product.brandId ??
                    null;

                const branchRecord = branchId
                    ? restaurants.find((entry) => entry.id === branchId)
                    : null;
                const branchSnapshot = branchId
                    ? {
                        id: branchId,
                        name:
                            detail?.branchName ||
                            branchRecord?.displayName ||
                            branchRecord?.name ||
                            product.branchName ||
                            product.restaurantName ||
                            'Branch',
                        displayName:
                            branchRecord?.displayName ||
                            branchRecord?.name ||
                            detail?.branchName ||
                            null,
                        address:
                            detail?.branchAddress ||
                            branchRecord?.address ||
                            [branchRecord?.street, branchRecord?.ward, branchRecord?.district, branchRecord?.city]
                                .filter(Boolean)
                                .join(', ') ||
                            '',
                        heroImage:
                            branchRecord?.heroImage ||
                            (Array.isArray(branchRecord?.images) ? branchRecord.images[0] : null) ||
                            detail?.branchImage ||
                            restaurantPlaceholderImage,
                        image:
                            (Array.isArray(branchRecord?.images) ? branchRecord.images[0] : null) ||
                            branchRecord?.heroImage ||
                            detail?.branchImage ||
                            restaurantPlaceholderImage,
                        phone: branchRecord?.phone || branchRecord?.branchPhone || null,
                        email: branchRecord?.email || branchRecord?.branchEmail || null,
                    }
                    : null;

                const brandRecord =
                    (brandRestaurantId && restaurantBrands.find((entry) => entry.id === brandRestaurantId)) ||
                    branchRecord?.brand ||
                    (brandRestaurantId && FALLBACK_RESTAURANTS.find((entry) => entry.id === brandRestaurantId)) ||
                    null;

                const restaurantId =
                    brandRestaurantId ||
                    brandRecord?.id ||
                    branchRecord?.brand?.id ||
                    branchId ||
                    null;

                if (!restaurantId) {
                    throw new Error('Unable to determine restaurant information. Please try again.');
                }

                const restaurantSnapshot = (() => {
                    const heroImageCandidate =
                        brandRecord?.heroImage ||
                        brandRecord?.coverImage ||
                        (Array.isArray(brandRecord?.images) ? brandRecord.images[0] : null) ||
                        branchSnapshot?.heroImage ||
                        restaurantPlaceholderImage;
                    return {
                        id: restaurantId,
                        name:
                            detail?.brandRestaurantName ||
                            brandRecord?.name ||
                            branchSnapshot?.name ||
                            'Restaurant',
                        heroImage: heroImageCandidate,
                        image: heroImageCandidate,
                        branch_id: branchId || null,
                        branch_name: branchSnapshot?.name || detail?.branchName || null,
                    };
                })();

                if (branchSnapshot) {
                    branchSnapshot.restaurant_id = restaurantId;
                    branchSnapshot.restaurant_name = restaurantSnapshot.name;
                }

                const existingStats = restaurantStats.get(restaurantId) || {
                    subtotal: 0,
                    itemCount: 0,
                    snapshot: restaurantSnapshot,
                };
                existingStats.subtotal += totalPrice;
                existingStats.itemCount += quantity;
                existingStats.snapshot = restaurantSnapshot;
                restaurantStats.set(restaurantId, existingStats);

                if (branchId) {
                    const existingBranchStats = branchStats.get(branchId) || {
                        subtotal: 0,
                        itemCount: 0,
                        snapshot: branchSnapshot,
                    };
                    existingBranchStats.subtotal += totalPrice;
                    existingBranchStats.itemCount += quantity;
                    existingBranchStats.snapshot = branchSnapshot || existingBranchStats.snapshot;
                    branchStats.set(branchId, existingBranchStats);
                }

                orderItems.push({
                    product_id: product._id,
                    variant_id: displaySize !== 'Standard' ? displaySize : null,
                    quantity,
                    unit_price: unitPrice,
                    total_price: totalPrice,
                    subtotal: subtotalPerUnit * quantity,
                    tax_amount: taxPerUnit * quantity,
                    tax_rate: detail?.taxRate ?? product.taxRate ?? 0,
                    options: detail?.options || [],
                    option_selections: detail?.options || [],
                    branch_product_id: branchProductId,
                    product_snapshot: {
                        title: product.title,
                        size: displaySize,
                        image: product.images?.[0],
                        restaurant_id: restaurantId,
                        restaurant_name: restaurantSnapshot.name,
                        branch_id: branchId || null,
                        branch_name: branchSnapshot?.name || detail?.branchName || null,
                        branch_address: branchSnapshot?.address || detail?.branchAddress || null,
                        price_components: {
                            base: baseUnitPrice,
                            size_delta: detail?.sizePriceDelta ?? 0,
                            options_total: detail?.optionPriceTotal ?? 0,
                            tax_amount: taxPerUnit,
                        },
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
        if (restaurantIds.length > 1) {
            throw new Error('Please place separate orders for each restaurant.');
        }

        const branchIds = Array.from(branchStats.keys());
        if (branchIds.length > 1) {
            throw new Error('Please place separate orders for each branch.');
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
        const restaurantNames = {};
        const pricingBreakdown = {};
        restaurantIds.forEach((restaurantId) => {
            const stats = restaurantStats.get(restaurantId);
            if (!stats) return;
            restaurantSnapshots[restaurantId] = stats.snapshot;
            pricingBreakdown[restaurantId] = {
                subtotal: stats.subtotal,
                item_count: stats.itemCount,
            };
            restaurantNames[restaurantId] = stats.snapshot?.name || null;
        });

        const branchSnapshots = {};
        const branchPricingBreakdown = {};
        const branchNames = {};
        branchIds.forEach((branchId) => {
            const stats = branchStats.get(branchId);
            if (!stats) return;
            branchSnapshots[branchId] = stats.snapshot;
            branchPricingBreakdown[branchId] = {
                subtotal: stats.subtotal,
                item_count: stats.itemCount,
            };
            branchNames[branchId] = stats.snapshot?.name || stats.snapshot?.displayName || null;
        });

        const metadata = {
            source: 'web-app',
            discount_code: appliedDiscountCode?.code || null,
            restaurant_ids: restaurantIds,
            restaurant_snapshots: restaurantSnapshots,
            restaurant_names: restaurantNames,
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
        if (branchIds.length) {
            metadata.branch_ids = branchIds;
            metadata.branch_snapshots = branchSnapshots;
            metadata.branch_pricing_breakdown = branchPricingBreakdown;
            metadata.branch_names = branchNames;
            metadata.branch_id = branchIds[0];
            if (branchIds.length === 1) {
                metadata.branch_snapshot = branchSnapshots[branchIds[0]];
            }
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
        if (branchIds.length === 1) {
            payload.branch_id = branchIds[0];
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
                        if (orderRecord.restaurant_id) {
                            paymentPayload.restaurant_id = orderRecord.restaurant_id;
                        }
                        if (orderRecord.branch_id) {
                            paymentPayload.branch_id = orderRecord.branch_id;
                        }
                        if (!paymentPayload.flow) {
                            paymentPayload.flow = paymentMethod === 'cod' ? 'cash' : 'online';
                        }
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
        cartItemDetails,
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
        setCardAccounts([]);
        setCustomerProfileOpen(false);
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
    const getBrandById = (brandId) => restaurantBrands.find((restaurant) => restaurant.id === brandId);
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
        cartItemDetails,
        setCartItemDetails,
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
        restaurantBrands,
        catalogLoading,
        catalogError,
        refreshCatalog,
        getRestaurantById,
        getBrandById,
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
        cardAccounts,
        linkCard: linkPaymentCard,
        removeCard: removePaymentCard,
        paymentOptions: paymentOptionList,
        restaurantReviews,
        addRestaurantReview,
        getReviewsForRestaurant,
        getRestaurantRatingSummary,
        updateLocalProfile,
        restaurantProfile,
        setRestaurantProfile,
        customerProfileOpen,
        openCustomerProfilePanel,
        closeCustomerProfilePanel,

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





