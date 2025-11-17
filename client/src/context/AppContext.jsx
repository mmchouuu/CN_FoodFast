// src/context/AppContext.jsx
import { useNavigate } from 'react-router-dom';
// import React, { createContext, useState, useContext, useEffect } from 'react';

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react'


import toast from 'react-hot-toast';
import catalogService from '../services/catalog';
import ordersService from '../services/orders';
import paymentsService from '../services/payments';
import { restaurantPlaceholderImage, dishPlaceholderImage } from '../utils/imageHelpers';
import { formatPaymentMethodLabel, formatPaymentStatusLabel } from '../utils/paymentDisplay';

// --- Auth Systems ---
import authService from '../services/auth';
import restaurantAuth from '../services/restaurantAuth';
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
const DEFAULT_PAYMENT_METHOD =
    (paymentOptionList.find((option) => option.id === 'card')?.id) ||
    paymentOptionList[0]?.id ||
    'card';
const ORDER_HISTORY_STATUSES = new Set(['delivered', 'completed', 'cancelled']);
const ORDER_REVIEWABLE_STATUSES = new Set(['delivered', 'completed']);
const ORDER_STATUS_SEQUENCE = [
    'pending',
    'confirmed',
    'cancelled',
    'preparing',
    'ready',
    'delivering',
    'completed',
];
const ACTIVE_ORDER_REFRESH_INTERVAL = 15000;

const toNumberOr = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePaymentMethodForSubmit = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!normalized) return 'card';
    // if (normalized === 'cod' || normalized === 'cash' || normalized === 'cash_on_delivery') {
    //     return 'cod';
    // }
    if (normalized === 'wallet') {
        return 'wallet';
    }
    if (normalized === 'credit' || normalized === 'debit') {
        return 'card';
    }
    if (normalized === 'card' || normalized === 'stripe') {
        return 'card';
    }
    return normalized;
};

const ensureArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

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

const adaptStripeCardFromApi = (record) => {
    if (!record) return null;
    const providerData =
        record.provider_data && typeof record.provider_data === 'object' ? record.provider_data : {};
    const fallbackBrand = detectCardBrand(providerData.last4 || record.last4 || '');
    return {
        id: record.id,
        brand: (record.brand || fallbackBrand || 'card').toUpperCase(),
        last4: record.last4 || providerData.last4 || '',
        expMonth: record.exp_month || providerData.exp_month || null,
        expYear: record.exp_year || providerData.exp_year || null,
        isDefault: Boolean(record.is_default),
        providerData,
    };
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
                    adapted.restaurantId = restaurant.id;
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

    const rawBranchAssignments =
        Array.isArray(product.branch_assignments)
            ? product.branch_assignments
            : Array.isArray(product.branchAssignments)
                ? product.branchAssignments
                : [];
    const branchAssignments = rawBranchAssignments
        .map((assignment) => {
            if (!assignment) return null;
            return {
                ...assignment,
                id:
                    assignment.id ||
                    assignment.branch_product_id ||
                    assignment.branchProductId ||
                    null,
                branch_id:
                    assignment.branch_id ||
                    assignment.branchId ||
                    assignment.branch ||
                    null,
                branch_category_id:
                    assignment.branch_category_id ||
                    assignment.branchCategoryId ||
                    null,
                category_id:
                    assignment.category_id ||
                    assignment.categoryId ||
                    null,
            };
        })
        .filter(Boolean);

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
        branchAssignments,
        branch_assignments: branchAssignments,
        branchProductId: product.branch_product_id || product.branchProductId || null,
        branchCategoryId: product.branch_category_id || product.branchCategoryId || null,
        categoryId: product.category_id || product.categoryId || null,
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
                    restaurantId: brand.id,
                    branchId: branch.id,
                    brandRestaurantId: brand.id,
                    brandName: brand.name,
                    cuisine: brand.cuisine,
                }))
                : [];

            if (!productsForBranch.length && Array.isArray(brand.products) && brand.products.length) {
                productsForBranch = brand.products.map((product) => ({
                    ...product,
                    restaurantId: brand.id,
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
                restaurantId: brand.id,
                brandRestaurantId: brand.id,
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

const formatTimelineTimestamp = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normaliseStatusKey = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const key = value.trim().toLowerCase();
    if (!key) {
        return null;
    }
    return ORDER_STATUS_SEQUENCE.includes(key) ? key : null;
};

const resolveTimelineSequence = (status) => {
    const normalised = typeof status === 'string' ? status.toLowerCase() : '';
    if (normalised === 'cancelled') {
        return ['pending', 'confirmed', 'cancelled'];
    }
    return ORDER_STATUS_SEQUENCE;
};

const buildDefaultTimeline = (status, placedAt) => {
    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : '';
    const sequence = resolveTimelineSequence(normalizedStatus);
    const statusIndex = sequence.indexOf(normalizedStatus);
    const placedTime = placedAt
        ? new Date(placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

    return sequence.map((key, index) => {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const isKnownStatus = statusIndex !== -1;
        const completed = isKnownStatus ? index <= statusIndex : index === 0;
        let timestamp = null;
        if (completed) {
            if (index === 0) {
                timestamp = placedTime;
            } else if (isKnownStatus && index === statusIndex) {
                timestamp = 'In progress';
            } else {
                timestamp = 'Completed';
            }
        }
        return {
            id: `status-${key}`,
            label,
            status: key,
            completed,
            timestamp,
        };
    });
};

const buildTimelineFromEvents = (rawOrder, status, placedAt) => {
    const events = Array.isArray(rawOrder?.events) ? rawOrder.events : [];
    const metadataTimeline = Array.isArray(rawOrder?.metadata?.timeline)
        ? rawOrder.metadata.timeline
        : [];
    if (!events.length && !metadataTimeline.length && !placedAt) {
        return null;
    }

    const timestamps = new Map();
    if (placedAt) {
        timestamps.set('pending', placedAt);
    }

    metadataTimeline.forEach((entry) => {
        if (!entry) return;
        const entryStatus = normaliseStatusKey(entry.status || entry.code);
        if (!entryStatus) return;
        const resolvedTimestamp = entry.at || entry.timestamp || entry.created_at || null;
        if (resolvedTimestamp && !timestamps.has(entryStatus)) {
            timestamps.set(entryStatus, resolvedTimestamp);
        }
    });

    events.forEach((event) => {
        if (!event) {
            return;
        }
        const type = event.event_type || event.type;
        const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
        if (type === 'OrderCreated') {
            if (event.created_at) {
                timestamps.set('pending', event.created_at);
            }
            return;
        }
        if (type === 'OrderStatusUpdated') {
            const nextStatus =
                normaliseStatusKey(payload.next) ||
                normaliseStatusKey(payload.status) ||
                normaliseStatusKey(payload.to);
            if (nextStatus) {
                timestamps.set(nextStatus, event.created_at || payload.at || null);
            }
            return;
        }
        if (type === 'OrderCompleted') {
            timestamps.set('completed', event.created_at || payload.at || null);
            return;
        }
        if (type === 'OrderCancelled') {
            timestamps.set('cancelled', event.created_at || payload.at || null);
        }
    });

    if (!timestamps.size) {
        return null;
    }

    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : '';
    const sequence = resolveTimelineSequence(normalizedStatus || 'pending');
    const statusIndex = sequence.indexOf(normalizedStatus);

    return sequence.map((key, index) => {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const rawTimestamp = timestamps.get(key);
        const formattedTimestamp = formatTimelineTimestamp(rawTimestamp);
        const completed = statusIndex >= 0 ? index <= statusIndex : Boolean(formattedTimestamp);
        let timestamp = formattedTimestamp;
        if (!timestamp) {
            if (statusIndex === index) {
                timestamp = 'In progress';
            } else if (index < statusIndex) {
                timestamp = 'Completed';
            } else {
                timestamp = 'Pending';
            }
        }
        return {
            id: `status-${key}`,
            label,
            status: key,
            completed,
            timestamp,
        };
    });
};

const adaptOrderFromApi = (order) => {
    if (!order) return null;
    const metadata = order.metadata && typeof order.metadata === 'object' ? order.metadata : {};
    const pricing = metadata.pricing && typeof metadata.pricing === 'object' ? metadata.pricing : {};
    const paymentMeta = metadata.payment && typeof metadata.payment === 'object' ? metadata.payment : {};
    const rawDeliverySnapshot =
        order.delivery_snapshot ||
        metadata.delivery_address ||
        order.shipping_address_snapshot ||
        null;
    let deliveryAddress = rawDeliverySnapshot;
    if (typeof rawDeliverySnapshot === 'string') {
        try {
            deliveryAddress = JSON.parse(rawDeliverySnapshot);
        } catch {
            deliveryAddress = { formatted: rawDeliverySnapshot };
        }
    }
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

    const rawItems = Array.isArray(order.items) ? order.items : [];
    const fallbackItemsSubtotal = rawItems.reduce(
        (sum, item) =>
            sum +
            toNumberOr(
                item.line_subtotal ??
                item.total_price ??
                (toNumberOr(item.unit_price, 0) * toNumberOr(item.quantity, 0)),
                0,
            ),
        0,
    );
    const fallbackTaxTotal = rawItems.reduce(
        (sum, item) => sum + toNumberOr(item.line_tax ?? 0, 0),
        0,
    );
    const fallbackItemTotal = rawItems.reduce(
        (sum, item) =>
            sum +
            toNumberOr(
                item.line_total ??
                item.total_price ??
                (toNumberOr(item.unit_price, 0) * toNumberOr(item.quantity, 0)),
                0,
            ),
        0,
    );

    const shippingFee = toNumberOr(
        order.shipping_fee,
        toNumberOr(pricing.shipping_fee ?? metadata.shipping_fee, 0),
    );
    const taxTotal = toNumberOr(
        order.tax_total,
        toNumberOr(pricing.tax_total, fallbackTaxTotal),
    );
    const orderDiscountAmount = toNumberOr(order.order_discount, 0);
    const itemDiscountAmount = toNumberOr(order.items_discount, 0);
    let discount = orderDiscountAmount + itemDiscountAmount;
    if (discount <= 0) {
        discount = toNumberOr(pricing.discount, 0);
    }

    const itemsSubtotal = toNumberOr(
        order.items_subtotal,
        toNumberOr(pricing.items_subtotal ?? pricing.subtotal, fallbackItemsSubtotal),
    );

    const totalAmount = toNumberOr(
        order.total_amount,
        toNumberOr(
            pricing.total ?? pricing.total_amount,
            Math.max(fallbackItemTotal + shippingFee - discount + taxTotal, 0),
        ),
    );

    const etaMinutes = toNumberOr(metadata.eta_minutes, 30);
    const paymentMethodRaw =
        typeof paymentMeta.method === 'string'
            ? paymentMeta.method
            : typeof order.payment_method === 'string'
                ? order.payment_method
                : 'cod';
    const paymentDetailsRaw = order.payment_details || null;
    const paymentFlowSource =
        paymentDetailsRaw?.flow ||
        paymentMeta.flow ||
        order.payment_flow ||
        order.flow ||
        null;
    const paymentFlow =
        typeof paymentFlowSource === 'string' && paymentFlowSource.trim()
            ? paymentFlowSource.trim().toLowerCase()
            : 'cash';
    const paymentDetails =
        paymentDetailsRaw && !paymentDetailsRaw.flow && paymentFlow
            ? { ...paymentDetailsRaw, flow: paymentFlow }
            : paymentDetailsRaw;
    const paymentMethodFallback =
        paymentFlow === 'online' && (!paymentDetails || paymentMethodRaw === 'cod')
            ? paymentMeta.method || 'online'
            : paymentMethodRaw;
    const paymentMethodLabel = formatPaymentMethodLabel(
        paymentDetails,
        paymentMethodFallback,
    );
    const paymentMethod = (paymentMethodFallback || 'cod').toUpperCase();
    const paymentStatusSourceRaw =
        paymentDetails?.status || paymentMeta.status || order.payment_status || '';
    const paymentStatusSource =
        typeof paymentStatusSourceRaw === 'string'
            ? paymentStatusSourceRaw.toLowerCase()
            : '';
    const resolvedPaymentStatus =
        paymentStatusSource === 'succeeded'
            ? 'paid'
            : paymentStatusSource || (order.payment_status || '').toLowerCase() || 'pending';
    const paymentStatusLabel = formatPaymentStatusLabel(
        paymentDetails || { status: resolvedPaymentStatus },
        paymentStatusSourceRaw || resolvedPaymentStatus || 'pending',
    );
    const paymentMethodId =
        paymentDetails?.payment_method_id ||
        paymentMeta.payment_method_id ||
        order.payment_method_id ||
        null;
    const paymentReference =
        paymentDetails?.payment_id ||
        paymentDetails?.transaction_id ||
        paymentMeta.reference ||
        null;
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
    const timelineFromEvents = buildTimelineFromEvents(order, lowerStatus, placedAt);
    const timeline = timelineFromEvents || buildDefaultTimeline(lowerStatus, placedAt);

    return {
        id: order.id,
        restaurantId: order.restaurant_id,
        branchId: order.branch_id,
        status: order.status,
        paymentStatus: resolvedPaymentStatus,
        paymentStatusLabel,
        paymentMethod,
        paymentMethodLabel,
        paymentMethodKey: paymentMethodRaw,
        paymentMethodId,
        paymentReference: paymentReference || null,
        paymentFlow,
        paymentDetails: paymentDetails
            ? { ...paymentDetails, displayLabel: paymentMethodLabel }
            : null,
        totalAmount,
        subtotal: itemsSubtotal,
        shippingFee,
        discount,
        taxTotal,
        currency: order.currency || 'VND',
        placedAt,
        updatedAt: order.updated_at,
        deliveredAt: metadata.delivered_at || null,
        etaMinutes,
        timeline,
        courier: metadata.courier || null,
        deliveryAddress,
        deliverySnapshot: deliveryAddress,
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
                unitPrice: toNumberOr(
                    item.unit_price,
                    toNumberOr(item.line_subtotal, 0) / Math.max(toNumberOr(item.quantity, 1), 1),
                ),
                price: toNumberOr(
                    item.line_total ?? item.total_price,
                    toNumberOr(item.unit_price, 0) * toNumberOr(item.quantity, 0),
                ),
                productSnapshot: item.product_snapshot || {},
                options: Array.isArray(item.options)
                    ? item.options
                    : Array.isArray(item.option_selections)
                        ? item.option_selections
                        : [],
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
        raw: order,
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

const shouldEnrichPaymentDetails = (order) => {
    if (!order) return false;
    const flow = (order.paymentFlow || '').toLowerCase();
    if (flow !== 'online') {
        return false;
    }
    if (
        order.paymentDetails &&
        (order.paymentDetails.method_details || order.paymentDetails.displayLabel)
    ) {
        return false;
    }
    return !order.paymentDetails;
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

    const [momoWallets, setMomoWallets] = useState([]);
    const [cardAccounts, setCardAccounts] = useState([]);
    const [selectedCardId, setSelectedCardId] = useState(null);
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
    const currency = 'VND';
    const delivery_charges = 15000;

    const resolveRestaurantIdByBranch = useCallback(
        (branchId) => {
            if (!branchId) return null;
            const normalized = typeof branchId === 'string' ? branchId.trim() : branchId;
            if (!normalized) return null;
            const branchEntry = restaurants.find(
                (entry) => entry?.branchId === normalized || entry?.id === normalized,
            );
            if (!branchEntry) return null;
            return (
                branchEntry.brand?.id ||
                branchEntry.brandRestaurantId ||
                branchEntry.restaurantId ||
                null
            );
        },
        [restaurants],
    );

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

    const enrichOrdersWithPaymentDetails = useCallback(async (ordersList) => {
        const orders = Array.isArray(ordersList) ? ordersList : [];
        const pending = orders.filter(shouldEnrichPaymentDetails);
        if (!pending.length) {
            return orders;
        }

        const replacements = new Map();
        await Promise.all(
            pending.map(async (order) => {
                try {
                    const data = await ordersService.get(order.id);
                    const adapted = adaptOrderFromApi(data);
                    if (adapted?.id) {
                        replacements.set(adapted.id, adapted);
                    }
                } catch (error) {
                    console.warn('[orders] failed to enrich payment details for order', order.id, error);
                }
            }),
        );

        if (!replacements.size) {
            return orders;
        }

        return orders.map((order) => replacements.get(order.id) || order);
    }, []);

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


    const refreshOrders = useCallback(async () => {
        if (!authToken || !authProfileId) {
            setActiveOrders([]);
            setPastOrders([]);
            setOrdersLoading(false);
            return { success: false, reason: 'unauthenticated' };
        }

        setOrdersLoading(true);
        try {
            const response = await ordersService.listByUser(authProfileId);
            const rawList = Array.isArray(response)
                ? response
                : Array.isArray(response?.orders)
                    ? response.orders
                    : Array.isArray(response?.data)
                        ? response.data
                        : [];
            const adapted = rawList.map(adaptOrderFromApi).filter(Boolean);
            const paymentAware = await enrichOrdersWithPaymentDetails(adapted);
            const { active, past } = splitOrdersByStatus(paymentAware);
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
    }, [authToken, authProfileId, enrichOrdersWithPaymentDetails]);

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

    const refreshMomoWallets = useCallback(async () => {
        if (!authToken && !authProfileId) {
            setMomoWallets([]);
            return [];
        }
        try {
            const data = await paymentsService.listMomoWallets({ userId: authProfileId || undefined });
            const rawList = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : Array.isArray(data?.items)
                        ? data.items
                        : [];
            setMomoWallets(rawList);
            return rawList;
        } catch (error) {
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
                setMomoWallets([]);
                return [];
            }
            const errorMessage = String(error?.response?.data?.message || '').toLowerCase();
            if (
                status === 404 ||
                status === 400 ||
                error?.response?.data?.code === 'BANK_ACCOUNT_NOT_FOUND' ||
                errorMessage.includes('not linked') ||
                errorMessage.includes('no bank account') ||
                errorMessage.includes('no momo wallet') ||
                errorMessage.includes('no wallet')
            ) {
                setMomoWallets([]);
                return [];
            }
            console.error('Failed to load MoMo wallets', error);
            toast.error('Unable to load MoMo wallets. Please try again later.');
            setMomoWallets([]);
            return [];
        }
    }, [authToken, authProfileId]);

    const linkMomoWallet = useCallback(
        async (payload = {}) => {
            if (!authToken && !authProfileId) {
                throw new Error('Please sign in to link a MoMo wallet.');
            }
            const requestPayload = { ...payload };
            if (!requestPayload.user_id && authProfileId) {
                requestPayload.user_id = authProfileId;
            }
            const record = await paymentsService.linkMomoWallet(requestPayload);
            await refreshMomoWallets();
            return record;
        },
        [authToken, authProfileId, refreshMomoWallets],
    );

    const refreshCardAccounts = useCallback(
        async () => {
            if (!authToken && !authProfileId) {
                setCardAccounts([]);
                setSelectedCardId(null);
                return [];
            }
            try {
                const response = await paymentsService.listStripeCards({ userId: authProfileId || undefined });
                const rawList = Array.isArray(response?.data)
                    ? response.data
                    : Array.isArray(response)
                        ? response
                        : [];
                const adapted = rawList.map(adaptStripeCardFromApi).filter(Boolean);
                setCardAccounts(adapted);
                setSelectedCardId((prev) => {
                    if (!adapted.length) return null;
                    const existing = adapted.find((card) => card.id === prev);
                    if (existing) return prev;
                    const preferred =
                        adapted.find((card) => card.isDefault) || adapted[0] || null;
                    return preferred ? preferred.id : null;
                });
                return adapted;
            } catch (error) {
                const status = error?.response?.status;
                if (status === 401 || status === 403) {
                    setCardAccounts([]);
                    setSelectedCardId(null);
                    return [];
                }
                console.error('Failed to load cards', error);
                toast.error('Unable to load saved cards. Please try again later.');
                setCardAccounts([]);
                setSelectedCardId(null);
                return [];
            }
        },
        [authToken, authProfileId],
    );

    const createStripeSetupIntent = useCallback(async () => {
        if (!authProfileId) {
            throw new Error('Please sign in to link a card.');
        }
        const result = await paymentsService.createStripeSetupIntent();
        return result;
    }, [authProfileId]);

    const linkPaymentCard = useCallback(
        async ({ paymentMethodId, customerId, isDefault } = {}) => {
            if (!authProfileId) {
                throw new Error('Please sign in to link a card.');
            }
            if (!paymentMethodId) {
                throw new Error('paymentMethodId is required');
            }
            if (!customerId) {
                throw new Error('customerId is required');
            }
            await paymentsService.confirmStripePaymentMethod({
                payment_method_id: paymentMethodId,
                customer_id: customerId,
                make_default: Boolean(isDefault),
            });
            const updated = await refreshCardAccounts();
            const linked =
                updated.find(
                    (card) => card?.providerData?.payment_method_id === paymentMethodId,
                ) || null;
            if (linked) {
                setSelectedCardId(linked.id);
            }
            return linked;
        },
        [authProfileId, refreshCardAccounts],
    );

    const removePaymentCard = useCallback(() => {
        throw new Error('Removing a saved card is not supported yet.');
    }, []);

    useEffect(() => {
        if (!authToken && !authProfileId) {
            setCardAccounts([]);
            setSelectedCardId(null);
            return;
        }
        refreshCardAccounts();
    }, [authToken, authProfileId, refreshCardAccounts]);

    useEffect(() => {
        refreshOrders();
    }, [refreshOrders]);

    useEffect(() => {
        if (!authToken || !authProfileId) {
            return undefined;
        }
        if (!activeOrders.length) {
            return undefined;
        }
        const intervalId = setInterval(() => {
            refreshOrders();
        }, ACTIVE_ORDER_REFRESH_INTERVAL);
        return () => {
            clearInterval(intervalId);
        };
    }, [authToken, authProfileId, activeOrders.length, refreshOrders]);

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
            setMomoWallets([]);
            return;
        }
        refreshMomoWallets();
    }, [authToken, authProfileId, refreshMomoWallets]);

    useEffect(() => {
        const hasWallets = momoWallets.length > 0;
        const hasCards = cardAccounts.length > 0;

        if (method === 'wallet' && !hasWallets && hasCards) {
            setMethod('card');
            return;
        }

        if (method === 'card' && !hasCards && hasWallets) {
            setMethod('wallet');
            setSelectedCardId(null);
            return;
        }

        if (method === 'card' && !hasCards) {
            setSelectedCardId(null);
            return;
        }

        if (method === 'card' && hasCards && !selectedCardId) {
            const preferred =
                cardAccounts.find((card) => card.isDefault) || cardAccounts[0] || null;
            setSelectedCardId(preferred ? preferred.id : null);
        }
    }, [method, momoWallets.length, cardAccounts, selectedCardId]);

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
        const paymentMethodCanonical = normalizePaymentMethodForSubmit(
            paymentMethodOverride || method || 'cod',
        );
        if (
            paymentMethodCanonical === 'wallet' &&
            !(Array.isArray(momoWallets) && momoWallets.length > 0)
        ) {
            throw new Error('Vui lòng liên kết ví MoMo trước khi thanh toán.');
        }
        const resolvePreferredCard = () => {
            if (paymentMethodCanonical !== 'card') return null;
            if (!Array.isArray(cardAccounts) || !cardAccounts.length) return null;
            if (selectedCardId) {
                const selected = cardAccounts.find((card) => card.id === selectedCardId);
                if (selected) return selected;
            }
            return cardAccounts.find((card) => card?.isDefault) || cardAccounts[0] || null;
        };
        const preferredCardAccount = resolvePreferredCard();
        if (paymentMethodCanonical === 'card' && !preferredCardAccount) {
            throw new Error('Vui lòng thêm thẻ thanh toán trước khi chọn phương thức này.');
        }
        const paymentMethodId =
            paymentMethodCanonical === 'card'
                ? preferredCardAccount?.id || null
                : null;

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
                const restaurantId =
                    product.restaurantId ||
                    product.brandRestaurantId ||
                    product.restaurant_id ||
                    detail?.product_snapshot?.restaurant_id ||
                    detail?.product_snapshot?.restaurantId ||
                    null;

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

                const branchId =
                    detail?.branchId ??
                    detail?.branch_id ??
                    product.branchId ??
                    product.branch_id ??
                    product.inventory?.branchId ??
                    product.inventory?.branch_id ??
                    null;

                if (branchId) {
                    let branchRecord = null;
                    if (restaurantRecord && Array.isArray(restaurantRecord.branches)) {
                        branchRecord =
                            restaurantRecord.branches.find((entry) => entry.id === branchId) || null;
                    }

                    const branchSnapshot = branchRecord
                        ? {
                            id: branchRecord.id,
                            restaurant_id: restaurantId,
                            restaurantId,
                            name:
                                branchRecord.displayName ||
                                branchRecord.name ||
                                detail?.branchName ||
                                branchRecord?.label ||
                                'Branch',
                            displayName: branchRecord.displayName || branchRecord.name || null,
                            address:
                                branchRecord.address ||
                                branchRecord.formattedAddress ||
                                detail?.branchAddress ||
                                '',
                            image:
                                branchRecord.heroImage ||
                                (Array.isArray(branchRecord.images) ? branchRecord.images[0] : null) ||
                                detail?.branchImage ||
                                resolvedRestaurantImage,
                        }
                        : {
                            id: branchId,
                            restaurant_id: restaurantId,
                            restaurantId,
                            name:
                                detail?.branchName ||
                                detail?.brandRestaurantName ||
                                existingStats.snapshot?.name ||
                                'Branch',
                            displayName: detail?.branchName || null,
                            address: detail?.branchAddress || '',
                            image: detail?.branchImage || resolvedRestaurantImage,
                        };

                    const branchStatsEntry = branchStats.get(branchId) || {
                        subtotal: 0,
                        itemCount: 0,
                        restaurantId,
                        snapshot: branchSnapshot,
                    };
                    branchStatsEntry.subtotal += totalPrice;
                    branchStatsEntry.itemCount += quantity;
                    branchStats.set(branchId, branchStatsEntry);
                }

                const branchAssignments =
                    product.branchAssignments ||
                    product.branch_assignments ||
                    [];
                const matchedAssignment =
                    branchAssignments.find((assignment) => {
                        if (!assignment) return false;
                        const assignmentBranchId =
                            assignment.branch_id ||
                            assignment.branchId ||
                            assignment.branch;
                        return branchId && assignmentBranchId === branchId;
                    }) || null;
                const branchProductIdCandidate =
                    detail?.branchProductId ||
                    product.branchProductId ||
                    matchedAssignment?.id ||
                    matchedAssignment?.branch_product_id ||
                    matchedAssignment?.branchProductId ||
                    null;
                const branchCategoryIdCandidate =
                    detail?.branchCategoryId ||
                    product.branchCategoryId ||
                    matchedAssignment?.branch_category_id ||
                    matchedAssignment?.branchCategoryId ||
                    matchedAssignment?.category_id ||
                    product.categoryId ||
                    product.category_id ||
                    null;

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
                    branch_product_id: branchProductIdCandidate,
                    branch_category_id: branchCategoryIdCandidate,
                    product_snapshot: {
                        title: product.title,
                        size: displaySize,
                        image: product.images?.[0],
                        restaurant_id: restaurantId,
                        branch_id: branchId || null,
                        restaurant_name: existingStats.snapshot?.name || restaurantRecord?.name || null,
                        branch_name: detail?.branchName || null,
                        branch_product_id: branchProductIdCandidate,
                        branch_category_id: branchCategoryIdCandidate,
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
            throw new Error('Hiện tại mỗi đơn chỉ hỗ trợ một nhà hàng. Vui lòng tách đơn hàng theo nhà hàng.');
        }
        const primaryRestaurantId = restaurantIds[0];
        const branchIds = Array.from(branchStats.keys());

        const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
        const shippingFee = subtotal === 0 ? 0 : delivery_charges;
        const discount = getDiscountAmount(subtotal);
        const totalAmount = Math.max(0, subtotal + shippingFee - discount);
        const currencyCode = (() => {
            const symbol = (currency || '').trim();
            if (/^[A-Za-z]{3}$/.test(symbol)) {
                return symbol.toUpperCase();
            }
            return 'VND';
        })();
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
        const restaurantPricingBreakdown = {};
        restaurantIds.forEach((restaurantId) => {
            const stats = restaurantStats.get(restaurantId);
            if (!stats) return;
            restaurantSnapshots[restaurantId] = stats.snapshot;
            restaurantNames[restaurantId] = stats.snapshot?.name || null;
            restaurantPricingBreakdown[restaurantId] = {
                subtotal: stats.subtotal,
                item_count: stats.itemCount,
            };
        });

        const branchSnapshots = {};
        const branchNames = {};
        const branchPricingBreakdown = {};
        branchIds.forEach((branchId) => {
            const stats = branchStats.get(branchId);
            if (!stats) return;
            branchSnapshots[branchId] = stats.snapshot;
            branchNames[branchId] = stats.snapshot?.displayName || stats.snapshot?.name || null;
            branchPricingBreakdown[branchId] = {
                subtotal: stats.subtotal,
                item_count: stats.itemCount,
            };
        });

        const paymentFlowValue = paymentMethodCanonical === 'card' ? 'online' : 'cash';

        const metadata = {
            source: 'web-app',
            discount_code: appliedDiscountCode?.code || null,
            restaurant_ids: restaurantIds,
            restaurant_snapshots: restaurantSnapshots,
            restaurant_names: restaurantNames,
            pricing_breakdown: restaurantPricingBreakdown,
            delivery_address_id: deliveryAddressId,
            delivery_address: deliveryAddressSnapshot,
        };
        if (restaurantIds.length === 1) {
            metadata.restaurant_snapshot = restaurantSnapshots[restaurantIds[0]];
        }
        if (branchIds.length) {
            metadata.branch_ids = branchIds;
            metadata.branch_snapshots = branchSnapshots;
            metadata.branch_pricing_breakdown = branchPricingBreakdown;
            metadata.branch_names = branchNames;
            if (branchIds.length === 1) {
                metadata.branch_id = branchIds[0];
                metadata.branch_snapshot = branchSnapshots[branchIds[0]];
            }
        }
        metadata.payment = {
            method: paymentMethodCanonical,
            status: 'pending',
            flow: paymentFlowValue,
            payment_method_id: paymentMethodId || null,
        };
        if (notes) {
            metadata.notes = notes;
        }

        const deliveryContactName =
            normalizeAddressField(deliveryAddressSource.recipient) ||
            authProfile?.fullName ||
            [authProfile?.first_name, authProfile?.last_name].filter(Boolean).join(' ').trim() ||
            user?.fullName ||
            null;
        const deliveryContactPhone =
            normalizeAddressField(deliveryAddressSource.phone) ||
            authProfile?.phone ||
            null;

        const payload = {
            order_items: orderItems,
            items: orderItems,
            shipping_fee: shippingFee,
            discount,
            total_amount: totalAmount,
            currency: currencyCode,
            payment_method: paymentMethodCanonical,
            payment_method_id: paymentMethodId,
            payment_flow: paymentFlowValue,
            paymentFlow: paymentFlowValue,
            fulfillment_type: 'delivery',
            delivery_address: deliveryAddressSnapshot,
            delivery_address_id: deliveryAddressId,
            selectedAddress: deliveryAddressSnapshot,
            selected_address: deliveryAddressSnapshot,
            selectedAddressId: deliveryAddressId,
            selected_address_id: deliveryAddressId,
            metadata,
            delivery: {
                delivery_address: deliveryAddressSnapshot,
                contact_name: deliveryContactName,
                contact_phone: deliveryContactPhone,
                delivery_status: 'pending',
            },
        };
        if (user?.id) {
            payload.user_id = user.id;
            payload.userId = user.id;
        }
        payload.restaurant_id = primaryRestaurantId;
        if (branchIds.length === 1) {
            payload.branch_id = branchIds[0];
        }
        if (paymentMethodId) {
            payload.paymentMethodId = paymentMethodId;
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
                        const paymentBranchId =
                            orderRecord.branch_id ||
                            orderRecord.branchId ||
                            (branchIds.length === 1 ? branchIds[0] : null) ||
                            orderRecord.metadata?.branch_id ||
                            null;
                        const paymentRestaurantId =
                            orderRecord.restaurant_id ||
                            orderRecord.restaurantId ||
                            (paymentBranchId ? resolveRestaurantIdByBranch(paymentBranchId) : null) ||
                            primaryRestaurantId ||
                            orderRecord.metadata?.restaurant_id ||
                            null;

                        if (paymentMethodCanonical !== 'card' || !paymentMethodId) {
                            return;
                        }

                        const paymentPayload = {
                            order_id: orderRecord.id,
                            user_id: user.id,
                            amount: paymentAmount,
                            currency: currencyCode,
                            payment_method: paymentMethodCanonical,
                            idempotency_key: `order-${orderRecord.id}`,
                            restaurant_id: paymentRestaurantId,
                            branch_id: paymentBranchId,
                        };
                        paymentPayload.payment_method_id = paymentMethodId;
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
        authProfile,
        appliedDiscountCode,
        restaurants,
        clearCart,
        refreshOrders,
        cardAccounts,
        momoWallets,
        selectedCardId,
        resolveRestaurantIdByBranch,
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

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (!restaurantProfile) {
            return;
        }
        try {
            const storedToken = localStorage.getItem('restaurant_token');
            if (storedToken) {
                return;
            }
            if (restaurantProfile.authToken) {
                localStorage.setItem('restaurant_token', restaurantProfile.authToken);
                return;
            }
            setRestaurantProfile(null);
            setIsOwner(false);
            toast.error('Owner session expired. Please sign in again.');
        } catch (error) {
            console.warn('Failed to sync owner session', error);
        }
    }, [restaurantProfile, setIsOwner]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }
        const handleOwnerExpiry = () => {
            setRestaurantProfile(null);
            setIsOwner(false);
            toast.error('Owner session expired. Please sign in again.');
        };
        window.addEventListener('restaurant:expired', handleOwnerExpiry);
        return () => window.removeEventListener('restaurant:expired', handleOwnerExpiry);
    }, [setIsOwner]);

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
    const loginWithCredentials = async (email, password, options = {}) => {
        const { accountType = 'auto' } = options;
        const normalizedEmail = typeof email === 'string' ? email.trim() : email;

        const handleCustomerSuccess = async (res) => {
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
            localStorage.removeItem('restaurant_token');
            localStorage.removeItem('restaurant_profile');
            setIsOwner(false);
            setRestaurantProfile(null);
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
            } catch {
                // ignore persistence failures
            }
            return { type: 'customer', response: res, user: sanitizedUser || res?.user || null };
        };

        const handleOwnerSuccess = (data) => {
            const ownerToken = data?.token || null;
            const ownerProfile = data?.user
                ? {
                    ...data.user,
                    authToken: ownerToken || data.user?.authToken || null,
                }
                : null;

            try {
                if (ownerToken) {
                    localStorage.setItem('restaurant_token', ownerToken);
                } else {
                    localStorage.removeItem('restaurant_token');
                }
            } catch (storageErr) {
                console.warn('Failed to persist owner token', storageErr);
            }

            setRestaurantProfile(ownerProfile);
            try {
                if (ownerProfile) {
                    localStorage.setItem('restaurant_profile', JSON.stringify(ownerProfile));
                } else {
                    localStorage.removeItem('restaurant_profile');
                }
            } catch (storageErr) {
                console.warn('Failed to persist owner profile', storageErr);
            }

            setIsOwner(Boolean(ownerProfile));
            setAuthToken(null);
            setAuthProfile(null);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_profile');
            toast.success(data?.message || 'Signed in successfully.');
            return { type: 'owner', response: data, user: ownerProfile };
        };

        const shouldTryCustomer = accountType !== 'owner';
        const shouldTryOwner = accountType !== 'customer';
        let lastError = null;

        if (shouldTryCustomer) {
            try {
                const result = await authService.login(normalizedEmail, password);
                return await handleCustomerSuccess(result);
            } catch (error) {
                lastError = error;
                if (accountType === 'customer') {
                    const message = error?.response?.data?.message || error.message || 'Login failed';
                    toast.error(message);
                    throw error;
                }
            }
        }

        if (shouldTryOwner) {
            try {
                const ownerResult = await restaurantAuth.login({ email: normalizedEmail, password });
                return handleOwnerSuccess(ownerResult);
            } catch (error) {
                lastError = error;
                if (accountType === 'owner') {
                    const message =
                        error?.response?.data?.message ||
                        error.message ||
                        'Unable to sign in to restaurant account.';
                    toast.error(message);
                    throw error;
                }
            }
        }

        const message =
            lastError?.response?.data?.message || lastError?.message || 'Login failed. Please try again.';
        toast.error(message);
        if (lastError) {
            throw lastError;
        }
        throw new Error(message);
    };

    const signupWithCredentials = async ({ firstName, lastName, email, password, phone }) => {
        try {
            const res = await authService.register({ firstName, lastName, email, password, phone });
            toast.success(res?.message || 'Account created. Please check your email for the OTP.');
            try {
                localStorage.setItem('pending_otp_sent_at', Date.now().toString());
            } catch {
                // ignore storage failures
            }
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

    const logoutLocal = (message = 'Logged out') => {
        setAuthToken(null);
        setAuthProfile(null);
        setAddresses([]);
        setSelectedAddressId(null);
        setMomoWallets([]);
        setCardAccounts([]);
        setSelectedCardId(null);
        setCustomerProfileOpen(false);
        setIsOwner(false);
        setRestaurantProfile(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_profile');
        localStorage.removeItem('pending_user_id');
        localStorage.removeItem('restaurant_token');
        localStorage.removeItem('restaurant_profile');
        toast(message);
    };

    const logoutOwner = () => {
        logoutLocal('Signed out of restaurant console.');
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
                localStorage.removeItem('pending_otp_sent_at');
            } catch {
                // ignore
            }
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

    const resendSignupOtp = async (email) => {
        if (!email) {
            const message = 'Please enter your email before requesting a new OTP.';
            toast.error(message);
            throw new Error(message);
        }
        try {
            const res = await authService.resendOtp(email);
            toast.success(res?.message || 'A new OTP has been sent to your inbox.');
            try {
                localStorage.setItem('pending_otp_sent_at', Date.now().toString());
            } catch {
                // ignore storage issues
            }
            return res;
        } catch (error) {
            const message = error?.response?.data?.message || error.message || 'Unable to resend OTP right now.';
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

    const updateOrderCollections = useCallback(
        (updatedOrder) => {
            if (!updatedOrder?.id) {
                return;
            }
            const status = (updatedOrder.status || '').toLowerCase();
            const isHistory = ORDER_HISTORY_STATUSES.has(status);

            setActiveOrders((prev) => {
                const filtered = prev.filter((order) => order.id !== updatedOrder.id);
                if (isHistory) {
                    return filtered;
                }
                return sortOrdersByPlacedAt([...filtered, updatedOrder]);
            });

            setPastOrders((prev) => {
                const filtered = prev.filter((order) => order.id !== updatedOrder.id);
                if (!isHistory) {
                    return filtered;
                }
                return sortOrdersByPlacedAt([...filtered, updatedOrder]);
            });
        },
        [setActiveOrders, setPastOrders],
    );

    const cancelOrder = useCallback(
        async (orderId, options = {}) => {
            if (!authToken) {
                throw new Error('Please sign in to cancel an order.');
            }
            if (!orderId) {
                throw new Error('Order identifier is required.');
            }
            try {
                const data = await ordersService.cancelOrder(orderId, options);
                const adapted = adaptOrderFromApi(data);
                if (adapted) {
                    updateOrderCollections(adapted);
                }
                toast.success('Đơn hàng đã được huỷ.');
                return adapted;
            } catch (error) {
                const message =
                    error?.response?.data?.error ||
                    error?.message ||
                    'Không thể huỷ đơn hàng. Vui lòng thử lại.';
                toast.error(message);
                throw new Error(message);
            }
        },
        [authToken, updateOrderCollections],
    );

    const confirmOrderDelivered = useCallback(
        async (orderId) => {
            if (!orderId) {
                throw new Error('Order identifier is required');
            }

            try {
                const data = await ordersService.confirmOrder(orderId);
                const adapted = adaptOrderFromApi(data);

                if (adapted) {
                    updateOrderCollections(adapted);
                }

                toast.success('Thank you! Your order is complete.');
                return adapted;
            } catch (error) {
                const message =
                    error?.response?.data?.error ||
                    error?.message ||
                    'Unable to confirm order.';
                toast.error(message);
                throw new Error(message);
            }
        },
        [updateOrderCollections],
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
        cancelOrder,
        confirmOrderDelivered,
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
        momoWallets,
        refreshMomoWallets,
        linkMomoWallet,
        cardAccounts,
        selectedCardId,
        setSelectedCardId,
        refreshCardAccounts,
        createStripeSetupIntent,
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
        logoutOwner,
        verifyOtp,
        resendSignupOtp,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
