'use strict';

const { pool } = require('../db');
const productClient = require('../clients/product.client');
const { publishOrderEvent, ensureQueueReady } = require('../utils/rabbitmq');

const ALLOW_CLIENT_PRICING_FALLBACK = process.env.ALLOW_CLIENT_PRICING_FALLBACK === 'true';
const DEFAULT_CURRENCY = 'VND';

const ORDER_STATUSES = new Set([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'completed',
  'cancelled',
]);

const PAYMENT_STATUSES = new Set([
  'unpaid',
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
]);

const FULFILLMENT_TYPES = new Set(['delivery', 'pickup', 'dinein']);

const PAYMENT_FLOWS = {
  cod: 'cash',
  cash: 'cash',
  cash_on_delivery: 'cash',
  wallet: 'online',
  card: 'online',
  stripe: 'online',
  momo: 'online',
  zalopay: 'online',
  bank_transfer: 'cash',
};

class ServiceError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details || undefined;
  }
}

class ValidationError extends ServiceError {
  constructor(message, details) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends ServiceError {
  constructor(message, details) {
    super(message, 404, details);
    this.name = 'NotFoundError';
  }
}

class ForbiddenError extends ServiceError {
  constructor(message, details) {
    super(message, 403, details);
    this.name = 'ForbiddenError';
  }
}

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toCurrency = (currency) => {
  if (!currency || typeof currency !== 'string') return DEFAULT_CURRENCY;
  const trimmed = currency.trim();
  return trimmed.length ? trimmed.toUpperCase() : DEFAULT_CURRENCY;
};

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const unique = (arr = []) => Array.from(new Set(arr));

const resolveUserId = (user = {}) =>
  user.id || user.userId || user.sub || user.user_id || null;

const normaliseUuid = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const determinePaymentFlow = (methodRaw) => {
  if (!methodRaw) return 'cash';
  const method = String(methodRaw).trim().toLowerCase();
  return PAYMENT_FLOWS[method] || 'cash';
};

const normaliseOrderStatus = (statusRaw) => {
  if (!statusRaw || typeof statusRaw !== 'string') return null;
  const status = statusRaw.trim().toLowerCase();
  if (!ORDER_STATUSES.has(status)) {
    throw new ValidationError(
      `status must be one of: ${Array.from(ORDER_STATUSES).join(', ')}`,
    );
  }
  return status;
};

const normalisePaymentStatus = (statusRaw) => {
  if (!statusRaw || typeof statusRaw !== 'string') return null;
  const status = statusRaw.trim().toLowerCase();
  if (!PAYMENT_STATUSES.has(status)) {
    throw new ValidationError(
      `payment_status must be one of: ${Array.from(PAYMENT_STATUSES).join(', ')}`,
    );
  }
  return status;
};

const extractRestaurantScope = (user = {}) => {
  const list = ensureArray(user.restaurant_ids)
    .concat(ensureArray(user.restaurantIds))
    .concat(ensureArray(user.restaurants))
    .concat(ensureArray(user.restaurantScopes))
    .concat(ensureArray(user.managed_restaurants))
    .concat(ensureArray(user.managedRestaurants));

  if (user.restaurant_id) list.push(user.restaurant_id);
  if (user.restaurantId) list.push(user.restaurantId);

  return unique(
    list
      .map((value) => (typeof value === 'string' ? value.trim() : null))
      .filter((value) => value && value.length),
  );
};

const extractBranchScope = (user = {}) => {
  const list = ensureArray(user.branch_ids)
    .concat(ensureArray(user.branchIds))
    .concat(ensureArray(user.managed_branches))
    .concat(ensureArray(user.managedBranches));

  if (user.branch_id) list.push(user.branch_id);
  if (user.branchId) list.push(user.branchId);

  return unique(
    list
      .map((value) => (typeof value === 'string' ? value.trim() : null))
      .filter((value) => value && value.length),
  );
};

const normaliseFulfillmentType = (value) => {
  if (!value || typeof value !== 'string') return 'delivery';
  const candidate = value.trim().toLowerCase();
  return FULFILLMENT_TYPES.has(candidate) ? candidate : 'delivery';
};

const normaliseSource = (value) => {
  if (!value || typeof value !== 'string') return 'app';
  const candidate = value.trim().toLowerCase();
  if (!candidate.length) return 'app';
  return candidate;
};

const ensureJson = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  return {};
};

function computePricingTotals(items, overrides = {}) {
  const subtotal = items.reduce(
    (acc, item) => acc + toNumber(item.unit_price, 0) * toNumber(item.quantity, 0),
    0,
  );
  const itemsDiscount = items.reduce((acc, item) => acc + toNumber(item.discount_total, 0), 0);
  const orderDiscount = toNumber(overrides.order_discount, 0);
  const surcharges = toNumber(overrides.surcharges_total, 0);
  const shippingFee = toNumber(overrides.shipping_fee, 0);
  const tipAmount = toNumber(overrides.tip_amount, 0);
  const taxTotal = toNumber(overrides.tax_total, 0);

  const total =
    subtotal - itemsDiscount - orderDiscount + surcharges + shippingFee + taxTotal + tipAmount;

  return {
    items_subtotal: Number(subtotal.toFixed(2)),
    items_discount: Number(itemsDiscount.toFixed(2)),
    order_discount: Number(orderDiscount.toFixed(2)),
    surcharges_total: Number(surcharges.toFixed(2)),
    shipping_fee: Number(shippingFee.toFixed(2)),
    tax_total: Number(taxTotal.toFixed(2)),
    tip_amount: Number(tipAmount.toFixed(2)),
    total_amount: Number(total.toFixed(2)),
    currency: toCurrency(overrides.currency || DEFAULT_CURRENCY),
  };
}

const normaliseOptionEntry = (entry) => {
  if (!entry) return null;
  const groupName =
    entry.option_group_name ||
    entry.group_name ||
    entry.group ||
    entry.groupLabel ||
    'Custom Option';
  const itemName =
    entry.option_item_name ||
    entry.item_name ||
    entry.item ||
    entry.name ||
    entry.label ||
    'Selection';
  return {
    option_group_name: String(groupName).trim() || 'Custom Option',
    option_item_name: String(itemName).trim() || 'Selection',
    price_delta: Number(toNumber(entry.price_delta ?? entry.price ?? entry.delta, 0).toFixed(2)),
  };
};

const normaliseTaxEntry = (entry) => {
  if (!entry) return null;
  const code =
    entry.tax_template_code ||
    entry.code ||
    entry.tax_code ||
    entry.template ||
    entry.template_code ||
    null;
  const rate = toNumber(entry.tax_rate ?? entry.rate, entry.percentage ?? entry.percent ?? 0);
  const amount = toNumber(entry.tax_amount ?? entry.amount, 0);
  return {
    tax_template_code: code,
    tax_rate: Number(rate.toFixed(2)),
    tax_amount: Number(amount.toFixed(2)),
  };
};

const normaliseQuoteItem = (item, index) => {
  const productId = normaliseUuid(
    item.product_id || item.productId || item.id || item.sku || item.product,
  );
  if (!productId) {
    throw new ValidationError(`Item at position ${index + 1} is missing product_id`);
  }
  const variantId = normaliseUuid(item.variant_id || item.variantId || item.variant);
  const quantity = toNumber(item.quantity ?? item.qty, 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ValidationError(`Item at position ${index + 1} has invalid quantity`);
  }
  const unitPrice = toNumber(
    item.unit_price ?? item.unitPrice ?? item.price_unit ?? item.price?.unit ?? item.price,
    0,
  );
  const totalPrice = toNumber(
    item.total_price ??
      item.totalPrice ??
      item.line_total ??
      item.price?.total ??
      unitPrice * quantity,
    0,
  );
  const discount = toNumber(
    item.discount_total ?? item.discount ?? item.discount_amount ?? item.discountTotal,
    0,
  );
  const options = ensureArray(item.options || item.option_items || item.selected_options)
    .map(normaliseOptionEntry)
    .filter(Boolean);
  const taxes = ensureArray(item.taxes || item.tax_breakdown || item.taxBreakdown)
    .map(normaliseTaxEntry)
    .filter(Boolean);

  return {
    product_id: productId,
    variant_id: variantId,
    quantity,
    unit_price: Number(unitPrice.toFixed(2)),
    total_price: Number(totalPrice.toFixed(2)),
    discount_total: Number(discount.toFixed(2)),
    product_snapshot:
      item.product_snapshot ||
      item.snapshot ||
      item.product ||
      item.catalog_snapshot ||
      item.catalog ||
      {},
    options,
    taxes,
    name: item.name || item.product_name || null,
    sku: item.sku || null,
  };
};

const normaliseAdjustments = (values, type) =>
  ensureArray(values)
    .map((entry) => {
      if (!entry) return null;
      if (type === 'discount') {
        const amount = toNumber(entry.amount ?? entry.discount ?? entry.value, 0);
        if (!amount) return null;
        return {
          source: (entry.source || entry.type || 'promo').toString(),
          code: entry.code || entry.promo_code || entry.name || null,
          amount: Number(amount.toFixed(2)),
          meta: ensureJson(entry.meta || entry.metadata),
        };
      }
      if (type === 'surcharge') {
        const amount = toNumber(entry.amount ?? entry.value ?? entry.charge, 0);
        if (!amount) return null;
        return {
          type: (entry.type || entry.code || entry.name || 'other').toString(),
          amount: Number(amount.toFixed(2)),
          meta: ensureJson(entry.meta || entry.metadata),
        };
      }
      if (type === 'promotion') {
        const amount = toNumber(entry.discount_amount ?? entry.amount ?? entry.value, 0);
        if (!amount) return null;
        return {
          promotion_id: normaliseUuid(entry.promotion_id || entry.id),
          code: entry.code || entry.name || null,
          discount_amount: Number(amount.toFixed(2)),
        };
      }
      return null;
    })
    .filter(Boolean);

const normaliseOrderTaxes = (values) =>
  ensureArray(values)
    .map(normaliseTaxEntry)
    .filter(Boolean);

const normaliseDeliveryPayload = (payload) => {
  if (!payload) return null;
  if (typeof payload !== 'object') return null;
  const status =
    payload.delivery_status || payload.status || payload.deliveryStatus || 'preparing';
  return {
    delivery_status: status,
    delivery_address:
      payload.delivery_address ||
      payload.address ||
      payload.destination ||
      payload.location ||
      null,
    estimated_at: payload.estimated_at || payload.estimatedAt || null,
    delivered_at: payload.delivered_at || payload.deliveredAt || null,
    provider: payload.provider || null,
    contact_name: payload.contact_name || payload.contactName || null,
    contact_phone: payload.contact_phone || payload.contactPhone || null,
    proof: ensureJson(payload.proof),
  };
};

const normaliseQuoteResponse = (quote, payload) => {
  if (!quote || typeof quote !== 'object') {
    throw new ValidationError('Invalid pricing response from product-service');
  }

  const items = ensureArray(quote.items || quote.line_items || quote.products).map(normaliseQuoteItem);
  if (!items.length) {
    throw new ValidationError('Pricing response did not contain any items');
  }

  const orderDiscounts = normaliseAdjustments(
    quote.discounts || quote.order_discounts || payload.discounts,
    'discount',
  );
  const surcharges = normaliseAdjustments(
    quote.surcharges || quote.order_surcharges || payload.surcharges,
    'surcharge',
  );
  const promotions = normaliseAdjustments(
    quote.promotions || quote.order_promotions || payload.promotions,
    'promotion',
  );
  const orderTaxes = normaliseOrderTaxes(
    quote.order_taxes || quote.tax_breakdowns || payload.order_taxes,
  );

  const delivery = normaliseDeliveryPayload(quote.delivery || payload.delivery);

  const totals = computePricingTotals(items, {
    order_discount:
      quote.totals?.order_discount ??
      quote.order_discount ??
      orderDiscounts.reduce((acc, discount) => acc + toNumber(discount.amount, 0), 0),
    surcharges_total:
      quote.totals?.surcharges_total ??
      quote.surcharge_total ??
      surcharges.reduce((acc, surcharge) => acc + toNumber(surcharge.amount, 0), 0),
    shipping_fee: quote.totals?.shipping_fee ?? quote.shipping_fee ?? payload.shipping_fee,
    tax_total:
      quote.totals?.tax_total ??
      quote.tax_total ??
      orderTaxes.reduce((acc, tax) => acc + toNumber(tax.tax_amount, 0), 0),
    tip_amount: quote.totals?.tip_amount ?? quote.tip_amount ?? payload.tip_amount,
    currency: quote.currency || payload.currency,
  });

  if (quote.totals?.total_amount) {
    totals.total_amount = Number(toNumber(quote.totals.total_amount, totals.total_amount).toFixed(2));
  }

  return {
    source: 'product-service',
    currency: totals.currency,
    items,
    totals,
    orderDiscounts,
    surcharges,
    promotions,
    orderTaxes,
    delivery,
    metadata: ensureJson(quote.metadata),
  };
};

const buildFallbackPricing = (payload) => {
  const items = ensureArray(payload.items).map((item, index) =>
    normaliseQuoteItem(
      {
        ...item,
        unit_price: item.unit_price ?? item.price ?? item.base_price,
        total_price: item.total_price ?? item.total ?? item.line_total,
        discount_total: item.discount_total ?? item.discount ?? item.discount_amount,
      },
      index,
    ),
  );

  if (!items.length) {
    throw new ValidationError('order items are required');
  }

  // Apply option price adjustments (e.g., size Large upcharge, toppings) into unit price if not already included
  for (const item of items) {
    const optionsDelta = ensureArray(item.options).reduce(
      (acc, opt) => acc + toNumber(opt.price_delta, 0),
      0,
    );
    if (optionsDelta !== 0) {
      const baseUnit = toNumber(item.unit_price, 0);
      item.unit_price = Number((baseUnit + optionsDelta).toFixed(2));
      // If total_price was not explicitly sent, recompute a line total from unit*qty
      const recomputedLine = Number((item.unit_price * toNumber(item.quantity, 0)).toFixed(2));
      if (!item.total_price || item.total_price === 0) {
        item.total_price = recomputedLine;
      }
    }
  }

  const orderDiscounts = normaliseAdjustments(payload.discounts, 'discount');
  const surcharges = normaliseAdjustments(payload.surcharges, 'surcharge');
  const promotions = normaliseAdjustments(payload.promotions, 'promotion');
  let orderTaxes = normaliseOrderTaxes(payload.order_taxes);
  const delivery = normaliseDeliveryPayload(payload.delivery);

  // If client didn't provide tax breakdowns, apply a default 7% sales tax over items subtotal
  if (!orderTaxes.length) {
    const subtotal = items.reduce(
      (acc, it) => acc + toNumber(it.unit_price, 0) * toNumber(it.quantity, 0),
      0,
    );
    const taxAmount = Number((subtotal * 0.07).toFixed(2));
    orderTaxes = [
      {
        tax_template_code: 'VAT_7',
        tax_rate: 7,
        tax_amount: taxAmount,
      },
    ];
  }

  const totals = computePricingTotals(items, {
    order_discount: orderDiscounts.reduce((acc, discount) => acc + discount.amount, 0),
    surcharges_total: surcharges.reduce((acc, surcharge) => acc + surcharge.amount, 0),
    shipping_fee: payload.shipping_fee,
    tax_total: orderTaxes.reduce((acc, tax) => acc + tax.tax_amount, 0),
    tip_amount: payload.tip_amount,
    currency: payload.currency,
  });

  if (payload.total_amount) {
    totals.total_amount = Number(toNumber(payload.total_amount, totals.total_amount).toFixed(2));
  }

  return {
    source: 'client-fallback',
    currency: totals.currency,
    items,
    totals,
    orderDiscounts,
    surcharges,
    promotions,
    orderTaxes,
    delivery,
    metadata: ensureJson(payload.metadata),
  };
};

const BRANCH_DEFAULT_TAX_TEMPLATE = 'BRANCH_TAX';
const FALLBACK_BRANCH_TAX_RATE = 7;

const collectOptionSelections = (item = {}) => {
  const all = [];
  const sources = [
    item.options,
    item.option_items,
    item.optionItems,
    item.selected_options,
    item.selectedOptions,
    item.addons,
    item.addOns,
  ];
  sources.forEach((source) => {
    ensureArray(source).forEach((entry) => {
      if (entry) {
        all.push(entry);
      }
    });
  });
  return all;
};

const resolveBranchProduct = (branchProducts = [], rawItem = {}) => {
  const branchProductId = normaliseUuid(
    rawItem.branch_product_id ||
      rawItem.branchProductId ||
      rawItem.branch_product ||
      rawItem.branchProduct,
  );
  const productId = normaliseUuid(
    rawItem.product_id || rawItem.productId || rawItem.id || rawItem.product,
  );

  if (branchProductId) {
    const byBranchProduct = branchProducts.find(
      (entry) => entry && entry.branch_product_id === branchProductId,
    );
    if (byBranchProduct) return byBranchProduct;
  }

  if (productId) {
    const byProductId = branchProducts.find((entry) => entry && entry.id === productId);
    if (byProductId) return byProductId;
  }

  return null;
};

const normaliseOptionMatch = (selection = {}, optionGroups = []) => {
  const candidateItemIds = [
    normaliseUuid(selection.option_item_id),
    normaliseUuid(selection.optionItemId),
    normaliseUuid(selection.item_id),
    normaliseUuid(selection.itemId),
    normaliseUuid(selection.id),
  ].filter(Boolean);

  const candidateGroupIds = [
    normaliseUuid(selection.option_group_id),
    normaliseUuid(selection.optionGroupId),
    normaliseUuid(selection.group_id),
    normaliseUuid(selection.groupId),
  ].filter(Boolean);

  const candidateItemNames = [
    selection.option_item_name,
    selection.optionItemName,
    selection.item_name,
    selection.itemName,
    selection.name,
    selection.label,
  ]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);

  const candidateGroupNames = [
    selection.option_group_name,
    selection.group_name,
    selection.groupName,
    selection.group,
  ]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);

  for (const group of optionGroups) {
    if (!group || !Array.isArray(group.items) || !group.items.length) continue;

    const groupMatchesId =
      !candidateGroupIds.length ||
      candidateGroupIds.includes(normaliseUuid(group.id)) ||
      candidateGroupIds.includes(normaliseUuid(group.option_group_id));

    const groupMatchesName =
      !candidateGroupNames.length ||
      candidateGroupNames.includes((group.name || '').toLowerCase().trim());

    if (!groupMatchesId && !groupMatchesName) {
      continue;
    }

    for (const option of group.items) {
      if (!option) continue;

      const optionId = normaliseUuid(option.id || option.option_item_id);
      const optionName = typeof option.name === 'string' ? option.name.trim().toLowerCase() : '';

      const idMatch = optionId && candidateItemIds.includes(optionId);
      const nameMatch = optionName && candidateItemNames.includes(optionName);

      if (idMatch || nameMatch) {
        return { group, option };
      }
    }
  }

  return null;
};

const aggregateOrderTaxes = (itemTaxes = []) => {
  if (!Array.isArray(itemTaxes) || !itemTaxes.length) return [];
  const grouped = new Map();

  itemTaxes.forEach((tax) => {
    if (!tax) return;
    const template = tax.tax_template_code || BRANCH_DEFAULT_TAX_TEMPLATE;
    const rate = Number(toNumber(tax.tax_rate, 0).toFixed(2));
    const key = `${template}:${rate}`;
    const existing = grouped.get(key) || {
      tax_template_code: template,
      tax_rate: rate,
      tax_amount: 0,
    };
    existing.tax_amount = Number((existing.tax_amount + toNumber(tax.tax_amount, 0)).toFixed(2));
    grouped.set(key, existing);
  });

  return Array.from(grouped.values());
};

const buildBranchPricingSnapshot = (payload = {}, branchCatalog = {}, explicitBranchId = null) => {
  const resolvedBranchId =
    normaliseUuid(explicitBranchId) ||
    normaliseUuid(payload.branch_id) ||
    normaliseUuid(payload.branchId);

  if (!resolvedBranchId) {
    throw new ValidationError('branch_id is required for branch orders');
  }

  const branches = ensureArray(branchCatalog.branches);
  const branch = branches.find((entry) => entry && entry.id === resolvedBranchId);
  if (!branch) {
    throw new ValidationError('branch not found for restaurant', {
      branch_id: resolvedBranchId,
    });
  }

  const branchProducts = ensureArray(branch.products);
  if (!branchProducts.length) {
    throw new ValidationError('branch has no available products', { branch_id: resolvedBranchId });
  }

  const items = ensureArray(payload.items).map((rawItem, index) => {
    const branchProduct = resolveBranchProduct(branchProducts, rawItem);
    if (!branchProduct) {
      throw new ValidationError(`item ${index + 1} is not available at this branch`, {
        item_index: index,
        product_id: rawItem?.product_id || rawItem?.productId || null,
        branch_id: resolvedBranchId,
      });
    }

    if (branchProduct.available === false || branchProduct.is_visible === false) {
      throw new ValidationError(`item ${index + 1} is not available right now`, {
        item_index: index,
        product_id: branchProduct.id,
      });
    }

    const quantity = toNumber(rawItem.quantity ?? rawItem.qty, 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError(`item ${index + 1} has invalid quantity`);
    }

    const basePrice = toNumber(branchProduct.base_price, 0);
    const optionGroups = ensureArray(branchProduct.options);
    const selections = collectOptionSelections(rawItem);

    let perUnitAddon = 0;
    const resolvedOptions = [];

    selections.forEach((selection) => {
      const match = normaliseOptionMatch(selection, optionGroups);
      if (!match) {
        throw new ValidationError('selected option is not available for this product', {
          product_id: branchProduct.id,
        });
      }

      const optionQuantity = Math.max(
        1,
        Math.floor(
          toNumber(selection.quantity ?? selection.qty ?? selection.count ?? 1, 1),
        ),
      );
      const delta = toNumber(
        match.option?.effective_price_delta ?? match.option?.price_delta,
        0,
      );
      const totalDelta = Number((delta * optionQuantity).toFixed(2));

      perUnitAddon += totalDelta;
      resolvedOptions.push({
        option_group_id: match.group?.id || null,
        option_group_name: match.group?.name || 'Option',
        option_item_id: match.option?.id || null,
        option_item_name: match.option?.name || 'Selection',
        price_delta: totalDelta,
      });
    });

    const unitPrice = Number((basePrice + perUnitAddon).toFixed(2));
    const totalPrice = Number((unitPrice * quantity).toFixed(2));

    const taxRate = branchProduct.tax_rate !== undefined && branchProduct.tax_rate !== null
      ? Number(toNumber(branchProduct.tax_rate, FALLBACK_BRANCH_TAX_RATE).toFixed(2))
      : FALLBACK_BRANCH_TAX_RATE;

    const lineTaxAmount = Number((totalPrice * taxRate / 100).toFixed(2));

    const productSnapshot = {
      product: {
        id: branchProduct.id,
        title: branchProduct.title,
        description: branchProduct.description,
        images: branchProduct.images,
        category_id: branchProduct.category_id,
      },
      branch_product: {
        id: branchProduct.branch_product_id || null,
        branch_id: resolvedBranchId,
        base_price: basePrice,
        price_mode: branchProduct.price_mode,
        base_price_override: branchProduct.base_price_override,
        tax_rate: taxRate,
      },
      branch: {
        id: branch.id,
        name: branch.name,
      },
      restaurant: branchCatalog.restaurant || null,
    };

    return {
      product_id: branchProduct.id,
      branch_product_id: branchProduct.branch_product_id || null,
      variant_id: rawItem.variant_id || rawItem.variantId || null,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      discount_total: toNumber(rawItem.discount_total ?? rawItem.discount ?? 0, 0),
      product_snapshot: productSnapshot,
      options: resolvedOptions,
      taxes: taxRate
        ? [
            {
              tax_template_code: branchProduct.tax_template_code || BRANCH_DEFAULT_TAX_TEMPLATE,
              tax_rate: taxRate,
              tax_amount: lineTaxAmount,
            },
          ]
        : [],
    };
  });

  const orderDiscounts = normaliseAdjustments(payload.discounts, 'discount');
  const surcharges = normaliseAdjustments(payload.surcharges, 'surcharge');
  const promotions = normaliseAdjustments(payload.promotions, 'promotion');
  const delivery = normaliseDeliveryPayload(payload.delivery);

  const flattenedTaxes = items.flatMap((item) => ensureArray(item.taxes));
  const orderTaxes = aggregateOrderTaxes(flattenedTaxes);

  const totals = computePricingTotals(items, {
    order_discount: orderDiscounts.reduce((acc, discount) => acc + discount.amount, 0),
    surcharges_total: surcharges.reduce((acc, surcharge) => acc + surcharge.amount, 0),
    shipping_fee: payload.shipping_fee,
    tax_total: orderTaxes.reduce((acc, entry) => acc + toNumber(entry.tax_amount, 0), 0),
    tip_amount: payload.tip_amount,
    currency: payload.currency,
  });

  return {
    source: 'branch-catalog',
    currency: totals.currency,
    items,
    totals,
    orderDiscounts,
    surcharges,
    promotions,
    orderTaxes,
    delivery,
    metadata: ensureJson(payload.metadata),
  };
};

async function computePricingSnapshot({ userId, payload, context }) {
  try {
    const restaurantId = payload.restaurant_id || payload.restaurantId;
    const branchId = payload.branch_id || payload.branchId;
    const catalog = await productClient.fetchBranchCatalog(restaurantId, branchId, {
      authorization: context?.authorization,
    });
    if (!catalog) {
      throw new Error('failed to load branch catalog');
    }
    return buildBranchPricingSnapshot(payload, catalog, branchId);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    console.error(
      '[order-service] Failed to fetch branch pricing from product-service:',
      error?.message || error,
    );
    if (!ALLOW_CLIENT_PRICING_FALLBACK) {
      throw new ValidationError('Unable to confirm pricing with product-service', {
        reason: error?.message,
      });
    }
    console.warn('[order-service] Falling back to client provided pricing snapshot');
    return buildFallbackPricing(payload);
  }
}

const enrichMetadata = ({ payload, pricing, payment, user }) => {
  const base =
    payload.metadata && typeof payload.metadata === 'object'
      ? { ...payload.metadata }
      : {};
  const placedAt = new Date().toISOString();

  const paymentMeta =
    base.payment && typeof base.payment === 'object' ? { ...base.payment } : {};
  paymentMeta.method = payment.method;
  paymentMeta.flow = payment.flow;
  paymentMeta.status = payment.status;
  paymentMeta.amount = pricing.totals.total_amount;
  paymentMeta.currency = pricing.totals.currency;

  const pricingMeta =
    base.pricing && typeof base.pricing === 'object' ? { ...base.pricing } : {};
  pricingMeta.source = pricing.source;
  pricingMeta.items_subtotal = pricing.totals.items_subtotal;
  pricingMeta.items_discount = pricing.totals.items_discount;
  pricingMeta.order_discount = pricing.totals.order_discount;
  pricingMeta.surcharges_total = pricing.totals.surcharges_total;
  pricingMeta.shipping_fee = pricing.totals.shipping_fee;
  pricingMeta.tax_total = pricing.totals.tax_total;
  pricingMeta.tip_amount = pricing.totals.tip_amount;
  pricingMeta.total_amount = pricing.totals.total_amount;

  const timeline = Array.isArray(base.timeline) ? base.timeline.slice() : [];
  if (!timeline.length) {
    timeline.push({
      code: 'order.created',
      label: 'Order created',
      at: placedAt,
      actor: user ? resolveUserId(user) : null,
    });
  }

  return {
    ...base,
    payment: paymentMeta,
    pricing: pricingMeta,
    timeline,
    delivery_address:
      base.delivery_address ||
      pricing.delivery?.delivery_address ||
      payload.delivery_address ||
      payload.delivery?.delivery_address ||
      null,
    placed_at: base.placed_at || placedAt,
  };
};

async function insertOrderGraph({
  client,
  userId,
  payload,
  pricing,
  payment,
}) {
  const {
    items,
    orderDiscounts,
    surcharges,
    promotions,
    orderTaxes,
    delivery,
    totals,
  } = pricing;

  const metadata = enrichMetadata({
    payload,
    pricing,
    payment,
    user: { id: userId },
  });

  const paymentStatus = payment.flow === 'online' ? 'pending' : 'unpaid';

  const orderResult = await client.query(
    `
      INSERT INTO orders (
        user_id,
        restaurant_id,
        branch_id,
        source,
        fulfillment_type,
        status,
        payment_status,
        items_subtotal,
        items_discount,
        order_discount,
        surcharges_total,
        shipping_fee,
        tax_total,
        tip_amount,
        total_amount,
        currency,
        promo_code,
        note,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      RETURNING *
    `,
    [
      userId,
      payload.restaurant_id,
      payload.branch_id || null,
      normaliseSource(payload.source),
      normaliseFulfillmentType(payload.fulfillment_type || payload.fulfillmentType),
      'pending',
      paymentStatus,
      totals.items_subtotal,
      totals.items_discount,
      totals.order_discount,
      totals.surcharges_total,
      totals.shipping_fee,
      totals.tax_total,
      totals.tip_amount,
      totals.total_amount,
      totals.currency,
      payload.promo_code || payload.promoCode || null,
      payload.note || null,
      metadata,
    ],
  );

  const order = orderResult.rows[0];

  const orderItems = [];
  for (const item of items) {
    const itemResult = await client.query(
      `
        INSERT INTO order_items (
          order_id,
          product_id,
          variant_id,
          product_snapshot,
          quantity,
          unit_price,
          total_price
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `,
      [
        order.id,
        item.product_id,
        item.variant_id,
        item.product_snapshot || {},
        item.quantity,
        item.unit_price,
        item.total_price,
      ],
    );
    const inserted = itemResult.rows[0];
    orderItems.push({ ...inserted, options: item.options || [], taxes: item.taxes || [] });
  }

  for (const item of orderItems) {
    if (item.options && item.options.length) {
      for (const option of item.options) {
        await client.query(
          `
            INSERT INTO order_item_options (
              order_item_id,
              option_group_name,
              option_item_name,
              price_delta
            )
            VALUES ($1,$2,$3,$4)
          `,
          [item.id, option.option_group_name, option.option_item_name, option.price_delta],
        );
      }
    }
    if (item.taxes && item.taxes.length) {
      for (const tax of item.taxes) {
        await client.query(
          `
            INSERT INTO order_item_tax_breakdowns (
              order_item_id,
              tax_template_code,
              tax_rate,
              tax_amount
            )
            VALUES ($1,$2,$3,$4)
          `,
          [item.id, tax.tax_template_code, tax.tax_rate, tax.tax_amount],
        );
      }
    }
  }

  for (const discount of orderDiscounts) {
    await client.query(
      `
        INSERT INTO order_discounts (
          order_id,
          source,
          code,
          amount,
          meta
        )
        VALUES ($1,$2,$3,$4,$5)
      `,
      [order.id, discount.source, discount.code, discount.amount, discount.meta || {}],
    );
  }

  for (const surcharge of surcharges) {
    await client.query(
      `
        INSERT INTO order_surcharges (
          order_id,
          type,
          amount,
          meta
        )
        VALUES ($1,$2,$3,$4)
      `,
      [order.id, surcharge.type, surcharge.amount, surcharge.meta || {}],
    );
  }

  for (const promotion of promotions) {
    await client.query(
      `
        INSERT INTO order_promotions (
          order_id,
          promotion_id,
          code,
          discount_amount
        )
        VALUES ($1,$2,$3,$4)
      `,
      [order.id, promotion.promotion_id, promotion.code, promotion.discount_amount],
    );
  }

  for (const tax of orderTaxes) {
    await client.query(
      `
        INSERT INTO order_tax_breakdowns (
          order_id,
          tax_template_code,
          tax_rate,
          tax_amount
        )
        VALUES ($1,$2,$3,$4)
      `,
      [order.id, tax.tax_template_code, tax.tax_rate, tax.tax_amount],
    );
  }

  if (delivery) {
    await client.query(
      `
        INSERT INTO deliveries (
          order_id,
          delivery_status,
          delivery_address,
          contact_name,
          contact_phone,
          estimated_at,
          delivered_at,
          provider,
          proof
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        order.id,
        delivery.delivery_status || 'preparing',
        typeof delivery.delivery_address === 'object'
          ? JSON.stringify(delivery.delivery_address)
          : delivery.delivery_address,
        delivery.contact_name || null,
        delivery.contact_phone || null,
        delivery.estimated_at || null,
        delivery.delivered_at || null,
        delivery.provider || null,
        delivery.proof || {},
      ],
    );
  }

  return order;
}

async function fetchOrdersByIds(orderIds, { client, includeEvents = false, includeRevisions = false } = {}) {
  if (!orderIds.length) return [];

  const orderRes = await client.query(
    `
      SELECT * FROM orders
      WHERE id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const ordersById = new Map(orderRes.rows.map((row) => [row.id, row]));
  if (!ordersById.size) return [];

  const itemsRes = await client.query(
    `
      SELECT * FROM order_items
      WHERE order_id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const optionsRes = await client.query(
    `
      SELECT
        oio.*,
        oi.order_id
      FROM order_item_options oio
      JOIN order_items oi ON oi.id = oio.order_item_id
      WHERE oi.order_id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const itemTaxRes = await client.query(
    `
      SELECT
        oitb.*,
        oi.order_id
      FROM order_item_tax_breakdowns oitb
      JOIN order_items oi ON oi.id = oitb.order_item_id
      WHERE oi.order_id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const orderTaxRes = await client.query(
    `
      SELECT * FROM order_tax_breakdowns
      WHERE order_id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const discountRes = await client.query(
    `
      SELECT * FROM order_discounts
      WHERE order_id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const surchargeRes = await client.query(
    `
      SELECT * FROM order_surcharges
      WHERE order_id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const promotionRes = await client.query(
    `
      SELECT * FROM order_promotions
      WHERE order_id = ANY($1::uuid[])
    `,
    [orderIds],
  );

  const deliveryRes = await client.query(
    `
      SELECT DISTINCT ON (order_id) *
      FROM deliveries
      WHERE order_id = ANY($1::uuid[])
      ORDER BY order_id, created_at DESC
    `,
    [orderIds],
  );

  let eventsRes = { rows: [] };
  if (includeEvents) {
    eventsRes = await client.query(
      `
        SELECT * FROM order_events
        WHERE order_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `,
      [orderIds],
    );
  }

  let revisionsRes = { rows: [] };
  if (includeRevisions) {
    revisionsRes = await client.query(
      `
        SELECT * FROM order_revisions
        WHERE order_id = ANY($1::uuid[])
        ORDER BY rev_no ASC
      `,
      [orderIds],
    );
  }

  const itemsByOrder = new Map();
  for (const item of itemsRes.rows) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push({ ...item, options: [], taxes: [] });
    itemsByOrder.set(item.order_id, list);
  }

  const optionsByItem = new Map();
  for (const option of optionsRes.rows) {
    const list = optionsByItem.get(option.order_item_id) || [];
    list.push({
      option_group_name: option.option_group_name,
      option_item_name: option.option_item_name,
      price_delta: Number(toNumber(option.price_delta, 0).toFixed(2)),
    });
    optionsByItem.set(option.order_item_id, list);
  }

  const itemTaxesByItem = new Map();
  for (const tax of itemTaxRes.rows) {
    const list = itemTaxesByItem.get(tax.order_item_id) || [];
    list.push({
      tax_template_code: tax.tax_template_code,
      tax_rate: Number(toNumber(tax.tax_rate, 0).toFixed(2)),
      tax_amount: Number(toNumber(tax.tax_amount, 0).toFixed(2)),
    });
    itemTaxesByItem.set(tax.order_item_id, list);
  }

  const orderTaxesByOrder = new Map();
  for (const tax of orderTaxRes.rows) {
    const list = orderTaxesByOrder.get(tax.order_id) || [];
    list.push({
      tax_template_code: tax.tax_template_code,
      tax_rate: Number(toNumber(tax.tax_rate, 0).toFixed(2)),
      tax_amount: Number(toNumber(tax.tax_amount, 0).toFixed(2)),
    });
    orderTaxesByOrder.set(tax.order_id, list);
  }

  const discountsByOrder = new Map();
  for (const discount of discountRes.rows) {
    const list = discountsByOrder.get(discount.order_id) || [];
    list.push({
      source: discount.source,
      code: discount.code,
      amount: Number(toNumber(discount.amount, 0).toFixed(2)),
      meta: discount.meta || {},
    });
    discountsByOrder.set(discount.order_id, list);
  }

  const surchargesByOrder = new Map();
  for (const surcharge of surchargeRes.rows) {
    const list = surchargesByOrder.get(surcharge.order_id) || [];
    list.push({
      type: surcharge.type,
      amount: Number(toNumber(surcharge.amount, 0).toFixed(2)),
      meta: surcharge.meta || {},
    });
    surchargesByOrder.set(surcharge.order_id, list);
  }

  const promotionsByOrder = new Map();
  for (const promotion of promotionRes.rows) {
    const list = promotionsByOrder.get(promotion.order_id) || [];
    list.push({
      promotion_id: promotion.promotion_id,
      code: promotion.code,
      discount_amount: Number(toNumber(promotion.discount_amount, 0).toFixed(2)),
    });
    promotionsByOrder.set(promotion.order_id, list);
  }

  const deliveryByOrder = new Map();
  for (const delivery of deliveryRes.rows) {
    let parsedAddress = delivery.delivery_address;
    if (typeof parsedAddress === 'string') {
      try {
        parsedAddress = JSON.parse(parsedAddress);
      } catch (err) {
        parsedAddress = parsedAddress;
      }
    }
    deliveryByOrder.set(delivery.order_id, {
      id: delivery.id,
      order_id: delivery.order_id,
      delivery_status: delivery.delivery_status,
      delivery_address: parsedAddress,
      contact_name: delivery.contact_name,
      contact_phone: delivery.contact_phone,
      estimated_at: delivery.estimated_at,
      delivered_at: delivery.delivered_at,
      provider: delivery.provider,
      proof: delivery.proof || {},
      created_at: delivery.created_at,
      updated_at: delivery.updated_at,
    });
  }

  const eventsByOrder = new Map();
  for (const event of eventsRes.rows) {
    const list = eventsByOrder.get(event.order_id) || [];
    list.push({
      id: event.id,
      order_id: event.order_id,
      event_type: event.event_type,
      payload: event.payload || {},
      actor_id: event.actor_id || null,
      created_at: event.created_at,
    });
    eventsByOrder.set(event.order_id, list);
  }

  const revisionsByOrder = new Map();
  for (const revision of revisionsRes.rows) {
    const list = revisionsByOrder.get(revision.order_id) || [];
    list.push({
      id: revision.id,
      order_id: revision.order_id,
      rev_no: revision.rev_no,
      snapshot: revision.snapshot || {},
      reason: revision.reason || null,
      created_by: revision.created_by || null,
      created_at: revision.created_at,
    });
    revisionsByOrder.set(revision.order_id, list);
  }

  const hydratedOrders = [];
  for (const orderId of orderIds) {
    const orderRow = ordersById.get(orderId);
    if (!orderRow) continue;
    const orderItems = itemsByOrder.get(orderId) || [];
    const enrichedItems = orderItems.map((item) => ({
      ...item,
      quantity: Number(toNumber(item.quantity, 0).toFixed(0)),
      unit_price: Number(toNumber(item.unit_price, 0).toFixed(2)),
      total_price: Number(toNumber(item.total_price, 0).toFixed(2)),
      product_snapshot: item.product_snapshot || {},
      options: optionsByItem.get(item.id) || [],
      taxes: itemTaxesByItem.get(item.id) || [],
    }));

    const order = {
      ...orderRow,
      items: enrichedItems,
      discounts: discountsByOrder.get(orderId) || [],
      surcharges: surchargesByOrder.get(orderId) || [],
      promotions: promotionsByOrder.get(orderId) || [],
      tax_breakdowns: orderTaxesByOrder.get(orderId) || [],
      delivery: deliveryByOrder.get(orderId) || null,
    };

    if (includeEvents) {
      order.events = eventsByOrder.get(orderId) || [];
    }

    if (includeRevisions) {
      order.revisions = revisionsByOrder.get(orderId) || [];
    }

    hydratedOrders.push(order);
  }

  return hydratedOrders;
}

async function fetchOrderById(orderId, { client = pool, includeEvents = true, includeRevisions = true } = {}) {
  const orders = await fetchOrdersByIds([orderId], { client, includeEvents, includeRevisions });
  return orders.length ? orders[0] : null;
}

async function logOrderEvent(client, { orderId, eventType, actorId = null, payload = {} }) {
  await client.query(
    `
      INSERT INTO order_events (
        order_id,
        event_type,
        actor_id,
        payload
      )
      VALUES ($1,$2,$3,$4)
    `,
    [orderId, eventType, actorId, payload],
  );
}

async function insertRevision(client, { orderId, snapshot, reason, actorId }) {
  const result = await client.query(
    `
      SELECT COALESCE(MAX(rev_no), 0) AS current_rev
      FROM order_revisions
      WHERE order_id = $1
    `,
    [orderId],
  );
  const currentRev = toNumber(result.rows[0]?.current_rev, 0);
  const nextRev = currentRev + 1;

  await client.query(
    `
      INSERT INTO order_revisions (
        order_id,
        rev_no,
        snapshot,
        reason,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5)
    `,
    [orderId, nextRev, snapshot, reason || null, actorId || null],
  );
}

async function enqueueOutbox(client, { aggregateType, aggregateId, eventType, payload }) {
  await client.query(
    `
      INSERT INTO outbox (
        aggregate_type,
        aggregate_id,
        event_type,
        payload
      )
      VALUES ($1,$2,$3,$4)
    `,
    [aggregateType, aggregateId, eventType, payload],
  );
}

async function createCustomerOrder({ user, payload = {}, context = {} }) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new ValidationError('unable to resolve current user');
  }
  if (!payload.restaurant_id) {
    throw new ValidationError('restaurant_id is required');
  }
  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw new ValidationError('order items are required');
  }

  const paymentMethodRaw =
    payload.payment_method || payload.paymentMethod || payload.method || 'cod';
  const paymentMethod = String(paymentMethodRaw).trim().toLowerCase() || 'cod';
  const paymentFlow = determinePaymentFlow(paymentMethod);

  const pricing = await computePricingSnapshot({ userId, payload, context });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await insertOrderGraph({
      client,
      userId,
      payload,
      pricing,
      payment: {
        method: paymentMethod,
        flow: paymentFlow,
        status: paymentFlow === 'online' ? 'pending' : 'unpaid',
      },
    });

    const hydrated = await fetchOrderById(order.id, {
      client,
      includeEvents: false,
      includeRevisions: false,
    });

    await logOrderEvent(client, {
      orderId: order.id,
      eventType: 'OrderCreated',
      actorId: userId,
      payload: {
        payment_method: paymentMethod,
        payment_flow: paymentFlow,
        totals: pricing.totals,
      },
    });

    await insertRevision(client, {
      orderId: order.id,
      snapshot: hydrated,
      reason: 'Order created',
      actorId: userId,
    });

    await enqueueOutbox(client, {
      aggregateType: 'Order',
      aggregateId: order.id,
      eventType: 'order.created',
      payload: {
        order_id: order.id,
        user_id: order.user_id,
        restaurant_id: order.restaurant_id,
        total: pricing.totals.total_amount,
        payment_method: paymentMethod,
        flow: paymentFlow,
      },
    });

    await client.query('COMMIT');

    const finalOrder = await fetchOrderById(order.id);

    try {
      await ensureQueueReady();
      await publishOrderEvent('order.created', {
        order_id: order.id,
        user_id: order.user_id,
        restaurant_id: order.restaurant_id,
        amount: pricing.totals.total_amount,
        currency: pricing.totals.currency,
      });

      await publishOrderEvent('PaymentPending', {
        order_id: order.id,
        user_id: order.user_id,
        restaurant_id: order.restaurant_id,
        amount: pricing.totals.total_amount,
        currency: pricing.totals.currency,
        flow: paymentFlow,
        method: paymentMethod,
        branch_id: order.branch_id,
      });
    } catch (eventError) {
      console.error('[order-service] Failed to publish order events:', eventError);
    }

    return finalOrder;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listAdminOrders({ query = {} }) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const client = await pool.connect();
  try {
    const params = [];
    let whereClause = '';

    if (query.status) {
      params.push(normaliseOrderStatus(query.status));
      whereClause += `${whereClause ? ' AND' : 'WHERE'} status = $${params.length}`;
    }

    if (query.payment_status) {
      params.push(normalisePaymentStatus(query.payment_status));
      whereClause += `${whereClause ? ' AND' : 'WHERE'} payment_status = $${params.length}`;
    }

    if (query.restaurant_id) {
      params.push(query.restaurant_id);
      whereClause += `${whereClause ? ' AND' : 'WHERE'} restaurant_id = $${params.length}`;
    }

    if (query.start_date) {
      params.push(new Date(query.start_date));
      whereClause += `${whereClause ? ' AND' : 'WHERE'} created_at >= $${params.length}`;
    }

    if (query.end_date) {
      params.push(new Date(query.end_date));
      whereClause += `${whereClause ? ' AND' : 'WHERE'} created_at <= $${params.length}`;
    }

    const ordersRes = await client.query(
      `
        SELECT *
        FROM orders
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    );

    const totalRes = await client.query(
      `
        SELECT COUNT(*) AS total
        FROM orders
        ${whereClause}
      `,
      params,
    );

    const hydrated = await fetchOrdersByIds(
      ordersRes.rows.map((row) => row.id),
      { client },
    );

    return {
      data: hydrated,
      pagination: {
        limit,
        offset,
        total: Number(totalRes.rows[0]?.total || 0),
      },
    };
  } finally {
    client.release();
  }
}

async function getAdminOrder({ orderId }) {
  return fetchOrderById(orderId);
}

async function patchAdminOrder({ user, orderId, payload = {} }) {
  const updates = [];
  const params = [];

  if (payload.status) {
    params.push(normaliseOrderStatus(payload.status));
    updates.push(`status = $${params.length}`);
  }

  if (payload.payment_status) {
    params.push(normalisePaymentStatus(payload.payment_status));
    updates.push(`payment_status = $${params.length}`);
  }

  if (payload.note !== undefined) {
    params.push(payload.note);
    updates.push(`note = $${params.length}`);
  }

  if (payload.promo_code !== undefined) {
    params.push(payload.promo_code);
    updates.push(`promo_code = $${params.length}`);
  }

  if (payload.fulfillment_type) {
    params.push(normaliseFulfillmentType(payload.fulfillment_type));
    updates.push(`fulfillment_type = $${params.length}`);
  }

  if (payload.total_amount) {
    params.push(Number(toNumber(payload.total_amount, 0).toFixed(2)));
    updates.push(`total_amount = $${params.length}`);
  }

  if (payload.items_subtotal) {
    params.push(Number(toNumber(payload.items_subtotal, 0).toFixed(2)));
    updates.push(`items_subtotal = $${params.length}`);
  }

  if (payload.order_discount) {
    params.push(Number(toNumber(payload.order_discount, 0).toFixed(2)));
    updates.push(`order_discount = $${params.length}`);
  }

  if (payload.shipping_fee) {
    params.push(Number(toNumber(payload.shipping_fee, 0).toFixed(2)));
    updates.push(`shipping_fee = $${params.length}`);
  }

  if (payload.tax_total) {
    params.push(Number(toNumber(payload.tax_total, 0).toFixed(2)));
    updates.push(`tax_total = $${params.length}`);
  }

  if (!updates.length) {
    throw new ValidationError('no valid fields to update');
  }

  params.push(orderId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE orders
        SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${params.length}
        RETURNING *
      `,
      params,
    );

    const order = result.rows[0];
    if (!order) {
      throw new NotFoundError('order not found');
    }

    await logOrderEvent(client, {
      orderId,
      eventType: 'OrderAdminUpdated',
      actorId: resolveUserId(user),
      payload: {
        updates: payload,
      },
    });

    await enqueueOutbox(client, {
      aggregateType: 'Order',
      aggregateId: orderId,
      eventType: 'order.admin_updated',
      payload: {
        order_id: orderId,
        updates: payload,
        actor: resolveUserId(user),
      },
    });

    await client.query('COMMIT');

    return fetchOrderById(orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteAdminOrder({ user, orderId, payload = {} }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE orders
        SET status = 'cancelled', updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [orderId],
    );

    const order = result.rows[0];
    if (!order) {
      throw new NotFoundError('order not found');
    }

    await logOrderEvent(client, {
      orderId,
      eventType: 'OrderAdminCancelled',
      actorId: resolveUserId(user),
      payload: {
        reason: payload.reason || 'admin_cancel',
      },
    });

    await enqueueOutbox(client, {
      aggregateType: 'Order',
      aggregateId: orderId,
      eventType: 'order.admin_updated',
      payload: {
        order_id: orderId,
        status: 'cancelled',
        actor: resolveUserId(user),
      },
    });

    await client.query('COMMIT');

    return fetchOrderById(orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handlePaymentEvent(event = {}) {
  const { event: eventType, payload } = event;
  if (!eventType || !payload || !payload.order_id) {
    return;
  }

  const orderId = payload.order_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1
        FOR UPDATE
      `,
      [orderId],
    );
    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return;
    }

    if (eventType === 'PaymentSucceeded') {
      const nextStatus = order.status === 'pending' ? 'confirmed' : order.status;
      await client.query(
        `
          UPDATE orders
          SET payment_status = 'paid',
              status = $1,
              updated_at = now()
          WHERE id = $2
        `,
        [nextStatus, orderId],
      );

      await logOrderEvent(client, {
        orderId,
        eventType: 'PaymentSucceeded',
        payload,
      });

      await enqueueOutbox(client, {
        aggregateType: 'Order',
        aggregateId: orderId,
        eventType: 'order.payment_succeeded',
        payload: {
          order_id: orderId,
          payment_id: payload.payment_id || null,
          amount: payload.amount,
        },
      });
    } else if (eventType === 'PaymentFailed') {
      await client.query(
        `
          UPDATE orders
          SET payment_status = 'failed',
              updated_at = now()
          WHERE id = $1
        `,
        [orderId],
      );

      await logOrderEvent(client, {
        orderId,
        eventType: 'PaymentFailed',
        payload,
      });
    } else if (eventType === 'RefundCompleted') {
      await client.query(
        `
          UPDATE orders
          SET payment_status = 'refunded',
              status = CASE WHEN status = 'completed' THEN 'cancelled' ELSE status END,
              updated_at = now()
          WHERE id = $1
        `,
        [orderId],
      );

      await logOrderEvent(client, {
        orderId,
        eventType: 'RefundCompleted',
        payload,
      });

      await enqueueOutbox(client, {
        aggregateType: 'Order',
        aggregateId: orderId,
        eventType: 'order.refunded',
        payload: {
          order_id: orderId,
          refund_id: payload.refund_id || null,
          amount: payload.amount || 0,
        },
      });
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[order-service] Failed to handle payment event:', error);
  } finally {
    client.release();
  }
}

module.exports = {
  createCustomerOrder,
  listCustomerOrders,
  getCustomerOrder,
  cancelCustomerOrder,
  listOwnerOrders,
  getOwnerOrder,
  updateOwnerOrderStatus,
  createOwnerOrderRevision,
  listAdminOrders,
  getAdminOrder,
  patchAdminOrder,
  deleteAdminOrder,
  handlePaymentEvent,
  ValidationError,
  ForbiddenError,
  NotFoundError,
};

async function listCustomerOrders({ user, query = {} }) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new ValidationError('unable to resolve current user');
  }

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const client = await pool.connect();
  try {
    const filters = [];
    const params = [userId];
    let paramIndex = params.length;

    filters.push(`user_id = $${paramIndex}`);

    if (query.status) {
      const status = normaliseOrderStatus(query.status);
      params.push(status);
      paramIndex += 1;
      filters.push(`status = $${paramIndex}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const ordersRes = await client.query(
      `
        SELECT *
        FROM orders
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    );

    const totalRes = await client.query(
      `
        SELECT COUNT(*) AS total
        FROM orders
        ${whereClause}
      `,
      params,
    );

    const orderIds = ordersRes.rows.map((row) => row.id);
    const hydrated = await fetchOrdersByIds(orderIds, { client });

    return {
      data: hydrated,
      pagination: {
        limit,
        offset,
        total: Number(totalRes.rows[0]?.total || 0),
      },
    };
  } finally {
    client.release();
  }
}

async function getCustomerOrder({ user, orderId }) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new ValidationError('unable to resolve current user');
  }

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1 AND user_id = $2
      `,
      [orderId, userId],
    );
    const order = orderRes.rows[0];
    if (!order) {
      return null;
    }
    return fetchOrderById(orderId, { client });
  } finally {
    client.release();
  }
}

async function cancelCustomerOrder({ user, orderId, payload = {} }) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new ValidationError('unable to resolve current user');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [orderId, userId],
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new NotFoundError('order not found');
    }

    if (!['pending', 'confirmed'].includes(order.status) || order.payment_status === 'paid') {
      throw new ValidationError('order cannot be cancelled at this stage');
    }

    await client.query(
      `
        UPDATE orders
        SET status = 'cancelled', updated_at = now()
        WHERE id = $1
      `,
      [orderId],
    );

    await logOrderEvent(client, {
      orderId,
      eventType: 'OrderCancelled',
      actorId: userId,
      payload: {
        reason: payload.reason || 'customer_request',
      },
    });

    await enqueueOutbox(client, {
      aggregateType: 'Order',
      aggregateId: orderId,
      eventType: 'order.status_updated',
      payload: {
        order_id: orderId,
        status: 'cancelled',
        actor: userId,
      },
    });

    await client.query('COMMIT');

    const updated = await fetchOrderById(orderId);

    try {
      await ensureQueueReady();
      await publishOrderEvent('order.status_updated', {
        order_id: orderId,
        status: 'cancelled',
        actor: userId,
      });
    } catch (eventError) {
      console.error('[order-service] Failed to publish cancellation event:', eventError);
    }

    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listOwnerOrders({ user, query = {} }) {
  const restaurantScope = extractRestaurantScope(user);
  if (!restaurantScope.length) {
    throw new ForbiddenError('owner does not manage any restaurants');
  }
  const branchScope = extractBranchScope(user)
    .map((value) => normaliseUuid(value))
    .filter(Boolean);

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const client = await pool.connect();
  try {
    const params = [restaurantScope];
    let whereClause = 'WHERE restaurant_id = ANY($1::uuid[])';

    if (query.status && query.status !== 'all') {
      const status = normaliseOrderStatus(query.status);
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (query.restaurant_id) {
      const restaurantId = normaliseUuid(query.restaurant_id);
      if (restaurantId && restaurantScope.includes(restaurantId)) {
        params.push(restaurantId);
        whereClause += ` AND restaurant_id = $${params.length}`;
      } else if (restaurantId) {
        throw new ForbiddenError('owner does not manage the requested restaurant');
      }
    }

    if (query.branch_id) {
      const branchId = normaliseUuid(query.branch_id);
      if (branchId) {
        if (branchScope.length && !branchScope.includes(branchId)) {
          throw new ForbiddenError('owner does not manage the requested branch');
        }
        params.push(branchId);
        whereClause += ` AND branch_id = $${params.length}`;
      }
    }

    if (!query.branch_id && branchScope.length) {
      params.push(branchScope);
      whereClause += ` AND (branch_id IS NULL OR branch_id = ANY($${params.length}::uuid[]))`;
    }

    if (query.start_date) {
      params.push(new Date(query.start_date));
      whereClause += ` AND created_at >= $${params.length}`;
    }

    if (query.end_date) {
      params.push(new Date(query.end_date));
      whereClause += ` AND created_at <= $${params.length}`;
    }

    const ordersRes = await client.query(
      `
        SELECT *
        FROM orders
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    );

    const totalRes = await client.query(
      `
        SELECT COUNT(*) AS total
        FROM orders
        ${whereClause}
      `,
      params,
    );

    const hydrated = await fetchOrdersByIds(
      ordersRes.rows.map((row) => row.id),
      { client },
    );

    return {
      data: hydrated,
      pagination: {
        limit,
        offset,
        total: Number(totalRes.rows[0]?.total || 0),
      },
    };
  } finally {
    client.release();
  }
}

async function getOwnerOrder({ user, orderId }) {
  const restaurantScope = extractRestaurantScope(user);
  if (!restaurantScope.length) {
    throw new ForbiddenError('owner does not manage any restaurants');
  }
  const branchScope = extractBranchScope(user)
    .map((value) => normaliseUuid(value))
    .filter(Boolean);

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1 AND restaurant_id = ANY($2::uuid[])
      `,
      [orderId, restaurantScope],
    );

    if (!orderRes.rows.length) {
      return null;
    }

    const order = orderRes.rows[0];
    if (branchScope.length && order.branch_id && !branchScope.includes(order.branch_id)) {
      throw new ForbiddenError('owner does not manage this branch');
    }

    return fetchOrderById(orderId, { client });
  } finally {
    client.release();
  }
}

async function updateOwnerOrderStatus({ user, orderId, payload = {} }) {
  const restaurantScope = extractRestaurantScope(user);
  if (!restaurantScope.length) {
    throw new ForbiddenError('owner does not manage any restaurants');
  }
  const branchScope = extractBranchScope(user)
    .map((value) => normaliseUuid(value))
    .filter(Boolean);

  const nextStatus = normaliseOrderStatus(payload.status);
  if (!nextStatus) {
    throw new ValidationError('status is required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1 AND restaurant_id = ANY($2::uuid[])
        FOR UPDATE
      `,
      [orderId, restaurantScope],
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new NotFoundError('order not found');
    }

    if (branchScope.length && order.branch_id && !branchScope.includes(order.branch_id)) {
      throw new ForbiddenError('owner does not manage this branch');
    }

    await client.query(
      `
        UPDATE orders
        SET status = $1, updated_at = now()
        WHERE id = $2
      `,
      [nextStatus, orderId],
    );

    await logOrderEvent(client, {
      orderId,
      eventType: 'OrderStatusUpdated',
      actorId: resolveUserId(user),
      payload: {
        previous: order.status,
        next: nextStatus,
        note: payload.note || null,
      },
    });

    await enqueueOutbox(client, {
      aggregateType: 'Order',
      aggregateId: orderId,
      eventType: 'order.status_updated',
      payload: {
        order_id: orderId,
        previous: order.status,
        next: nextStatus,
        actor: resolveUserId(user),
      },
    });

    await client.query('COMMIT');

    const updated = await fetchOrderById(orderId);

    try {
      await ensureQueueReady();
      await publishOrderEvent('order.status_updated', {
        order_id: orderId,
        previous: order.status,
        next: nextStatus,
        actor: resolveUserId(user),
      });
    } catch (eventError) {
      console.error('[order-service] Failed to publish status update event:', eventError);
    }

    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createOwnerOrderRevision({ user, orderId, payload = {} }) {
  const restaurantScope = extractRestaurantScope(user);
  if (!restaurantScope.length) {
    throw new ForbiddenError('owner does not manage any restaurants');
  }
  const branchScope = extractBranchScope(user)
    .map((value) => normaliseUuid(value))
    .filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1 AND restaurant_id = ANY($2::uuid[])
        FOR UPDATE
      `,
      [orderId, restaurantScope],
    );

    if (!orderRes.rows.length) {
      throw new NotFoundError('order not found');
    }

    const order = orderRes.rows[0];
    if (branchScope.length && order.branch_id && !branchScope.includes(order.branch_id)) {
      throw new ForbiddenError('owner does not manage this branch');
    }

    const snapshot =
      payload.snapshot ||
      (await fetchOrderById(orderId, {
        client,
        includeEvents: true,
        includeRevisions: true,
      }));

    await insertRevision(client, {
      orderId,
      snapshot,
      reason: payload.reason || 'Manual revision',
      actorId: resolveUserId(user),
    });

    await logOrderEvent(client, {
      orderId,
      eventType: 'OrderRevisionCreated',
      actorId: resolveUserId(user),
      payload: {
        reason: payload.reason || null,
      },
    });

    await enqueueOutbox(client, {
      aggregateType: 'Order',
      aggregateId: orderId,
      eventType: 'order.status_updated',
      payload: {
        order_id: orderId,
        revision_reason: payload.reason || null,
      },
    });

    await client.query('COMMIT');

    return {
      order_id: orderId,
      snapshot,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
