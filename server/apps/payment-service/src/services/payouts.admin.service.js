const { pool } = require('../models/payment.model');
const { fetchOrderById } = require('../clients/order.client');

const DAY_MS = 86400000;
const ACTIVE_STATUSES = new Set(['open', 'ready', 'payout_scheduled']);

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const startOfDay = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Date(Date.now());
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => new Date(startOfDay(date).getTime() + days * DAY_MS);

const resolvePeriodRange = ({ period, startDate, endDate } = {}) => {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  let rangeStart = addDays(now, -mondayOffset);
  let rangeEnd = addDays(rangeStart, 7);

  switch (period) {
    case 'last-week':
      rangeEnd = rangeStart;
      rangeStart = addDays(rangeStart, -7);
      break;
    case 'this-month':
    case 'current-month':
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'last-month': {
      const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = firstOfCurrent;
      rangeStart = new Date(firstOfCurrent.getFullYear(), firstOfCurrent.getMonth() - 1, 1);
      break;
    }
    case 'custom':
      if (startDate) {
        rangeStart = startOfDay(startDate);
      }
      if (endDate) {
        rangeEnd = startOfDay(endDate);
      }
      break;
    default:
      break;
  }

  if (startDate && period !== 'custom') {
    rangeStart = startOfDay(startDate);
  }
  if (endDate && period !== 'custom') {
    rangeEnd = startOfDay(endDate);
  }

  if (!rangeEnd || rangeEnd <= rangeStart) {
    rangeEnd = addDays(rangeStart, 7);
  }

  return {
    start: rangeStart,
    end: rangeEnd,
  };
};

const deriveStatusLabel = (row) => {
  if (!row) return 'pending';
  const openCount = Number(row.open_settlements || 0);
  const processing = Number(row.processing_payouts || 0);
  const payoutCount =
    processing + Number(row.paid_payouts || 0) + Number(row.pending_payouts || 0);
  if (openCount > 0) {
    return 'pending';
  }
  if (processing > 0 && processing >= Math.max(1, payoutCount / 2)) {
    return 'processing';
  }
  return 'all_paid';
};

const deriveOrderStatus = (settlementStatus, payoutStatus) => {
  if (['invoiced', 'closed'].includes(settlementStatus) || payoutStatus === 'paid') {
    return 'paid';
  }
  if (settlementStatus === 'payout_scheduled' || payoutStatus === 'processing') {
    return 'processing';
  }
  return 'pending';
};

const buildCycleLabel = (start, end) => {
  if (!start || !end) return null;
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  try {
    return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
  } catch (err) {
    return null;
  }
};

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const extractShippingFeeFromOrder = (order = {}) => {
  if (!order) return 0;
  const candidates = [];
  candidates.push(
    order.shipping_fee,
    order.shippingFee,
    order.delivery_fee,
    order.deliveryFee,
    order.total_shipping_fee,
  );
  if (order.totals && typeof order.totals === 'object') {
    candidates.push(order.totals.shipping_fee, order.totals.delivery_fee);
  }
  if (order.pricing && typeof order.pricing === 'object') {
    candidates.push(order.pricing.shipping_fee, order.pricing.delivery_fee);
    if (order.pricing.totals && typeof order.pricing.totals === 'object') {
      candidates.push(order.pricing.totals.shipping_fee, order.pricing.totals.delivery_fee);
    }
  }
  const metadata = parseJson(order.metadata);
  if (metadata?.pricing && typeof metadata.pricing === 'object') {
    candidates.push(metadata.pricing.shipping_fee, metadata.pricing.delivery_fee);
    if (metadata.pricing.totals && typeof metadata.pricing.totals === 'object') {
      candidates.push(
        metadata.pricing.totals.shipping_fee,
        metadata.pricing.totals.delivery_fee,
      );
    }
  }
  for (const candidate of candidates) {
    const amount = toNumber(candidate);
    if (amount) {
      return amount;
    }
  }
  return 0;
};

const resolveShippingFeeForOrder = async (orderId, cache = new Map()) => {
  if (!orderId) return 0;
  if (cache.has(orderId)) {
    return cache.get(orderId);
  }
  let shippingFee = 0;
  try {
    const order = await fetchOrderById(orderId);
    shippingFee = extractShippingFeeFromOrder(order);
  } catch (error) {
    console.warn(
      '[payment-service] Unable to resolve shipping fee for order',
      orderId,
      error?.message || error,
    );
  }
  const normalized = toNumber(shippingFee);
  cache.set(orderId, normalized);
  return normalized;
};

const buildFallbackShippingTotals = async (rows, cache = new Map()) => {
  const missing = rows.filter((row) => toNumber(row.shipping_total) <= 0).map((row) => row.id);
  if (!missing.length) {
    return new Map();
  }
  const itemsRes = await pool.query(
    `
      SELECT settlement_id, order_id
        FROM restaurant_settlement_items
       WHERE settlement_id = ANY($1::uuid[])
         AND item_type = 'payment'
         AND order_id IS NOT NULL
    `,
    [missing],
  );
  const grouped = itemsRes.rows.reduce((acc, row) => {
    if (!row.order_id) return acc;
    const list = acc.get(row.settlement_id) || [];
    list.push(row.order_id);
    acc.set(row.settlement_id, list);
    return acc;
  }, new Map());
  const fallback = new Map();
  await Promise.all(
    Array.from(grouped.entries()).map(async ([settlementId, orderIds]) => {
      if (!orderIds.length) {
        fallback.set(settlementId, 0);
        return;
      }
      const uniqueOrderIds = Array.from(new Set(orderIds));
      const fees = await Promise.all(
        uniqueOrderIds.map((orderId) => resolveShippingFeeForOrder(orderId, cache)),
      );
      const total = fees.reduce((sum, fee) => sum + fee, 0);
      fallback.set(settlementId, total);
    }),
  );
  return fallback;
};

async function listRestaurantPayouts(filters = {}) {
  const { start, end } = resolvePeriodRange(filters);
  const params = [start, end];

  const query = `
    WITH filtered AS (
      SELECT
        rs.*,
        p.status AS payout_status,
        p.paid_at AS payout_paid_at
      FROM restaurant_settlements rs
      LEFT JOIN payouts p ON p.settlement_id = rs.id
      WHERE ($1::timestamptz IS NULL OR rs.period_end > $1)
        AND ($2::timestamptz IS NULL OR rs.period_start < $2)
    )
    SELECT
      restaurant_id,
      COUNT(DISTINCT branch_id) AS branch_count,
      COALESCE(SUM(gross), 0) AS total_gross,
      COALESCE(SUM(net_result), 0) AS total_net,
      COALESCE(
        SUM(CASE WHEN status IN ('open','ready','payout_scheduled') THEN net_result ELSE 0 END),
        0
      ) AS pending_net,
      MAX(payout_paid_at) AS last_paid_at,
      SUM(CASE WHEN status IN ('open','ready','payout_scheduled') THEN 1 ELSE 0 END) AS open_settlements,
      SUM(CASE WHEN payout_status = 'processing' THEN 1 ELSE 0 END) AS processing_payouts,
      SUM(CASE WHEN payout_status = 'paid' THEN 1 ELSE 0 END) AS paid_payouts,
      SUM(CASE WHEN payout_status NOT IN ('paid') AND payout_status IS NOT NULL THEN 1 ELSE 0 END) AS pending_payouts,
      COUNT(*) AS settlement_count,
      COUNT(DISTINCT CASE WHEN status IN ('open','ready','payout_scheduled') THEN branch_id END) AS pending_branches
    FROM filtered
    GROUP BY restaurant_id
    ORDER BY total_gross DESC
  `;

  const [rowsRes, ledgerRes] = await Promise.all([
    pool.query(query, params),
    pool.query('SELECT COALESCE(SUM(current_balance), 0) AS total_sales FROM platform_ledger_balances'),
  ]);

  const restaurants = rowsRes.rows.map((row) => {
    const pendingNet = toNumber(row.pending_net);
    return {
      restaurantId: row.restaurant_id,
      branchCount: Number(row.branch_count || 0),
      totalOnlineSales: toNumber(row.total_gross),
      totalNetAmount: toNumber(row.total_net),
      totalPendingPayout: pendingNet,
      lastPayoutDate: row.last_paid_at,
      pendingBranches: Number(row.pending_branches || 0),
      settlementCount: Number(row.settlement_count || 0),
      overallStatus: deriveStatusLabel(row),
    };
  });

  const summary = restaurants.reduce(
    (acc, restaurant) => {
      acc.pendingPayout += restaurant.totalPendingPayout;
      acc.pendingBranches += restaurant.pendingBranches;
      if (restaurant.totalPendingPayout > 0) {
        acc.restaurantsPending += 1;
      }
      acc.totalOnlineSalesPeriod += restaurant.totalOnlineSales;
      return acc;
    },
    { totalOnlineSalesPeriod: 0, pendingPayout: 0, restaurantsPending: 0, pendingBranches: 0 },
  );

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    summary: {
      totalOnlineSales: toNumber(ledgerRes.rows[0]?.total_sales),
      totalOnlineSalesPeriod: summary.totalOnlineSalesPeriod,
      pendingPayout: summary.pendingPayout,
      restaurantsPending: summary.restaurantsPending,
      pendingBranches: summary.pendingBranches,
    },
    restaurants,
  };
}

async function listRestaurantBranchSettlements(restaurantId, filters = {}) {
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }
  const { start, end } = resolvePeriodRange(filters);
  const params = [restaurantId, start, end];

  const query = `
    WITH metrics AS (
      SELECT
        rs.*,
        COALESCE(SUM(CASE WHEN rsi.item_type = 'payment' THEN 1 ELSE 0 END), 0) AS order_count,
        COALESCE(SUM(CASE WHEN rsi.item_type = 'payment' THEN rsi.amount ELSE 0 END), 0) AS payment_total
      FROM restaurant_settlements rs
      LEFT JOIN restaurant_settlement_items rsi ON rsi.settlement_id = rs.id
      WHERE rs.restaurant_id = $1
        AND ($2::timestamptz IS NULL OR rs.period_end > $2)
        AND ($3::timestamptz IS NULL OR rs.period_start < $3)
      GROUP BY rs.id
    ),
    ranked AS (
      SELECT
        metrics.*,
        p.status AS payout_status,
        p.amount AS payout_amount,
        p.paid_at AS payout_paid_at,
        ROW_NUMBER() OVER (PARTITION BY metrics.branch_id ORDER BY metrics.period_end DESC) AS rank
      FROM metrics
      LEFT JOIN payouts p ON p.settlement_id = metrics.id
    )
    SELECT *
    FROM ranked
    WHERE rank = 1
    ORDER BY payment_total DESC
  `;

  const { rows } = await pool.query(query, params);
  const branches = rows.map((row) => {
    const unsettled = ACTIVE_STATUSES.has(row.status);
    const pendingPayout = unsettled
      ? toNumber(row.net_result)
      : row.payout_status !== 'paid'
      ? toNumber(row.payout_amount)
      : 0;
    return {
      branchId: row.branch_id,
      settlementId: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      onlineOrders: Number(row.order_count || 0),
      totalSales: toNumber(row.payment_total),
      netAmount: toNumber(row.net_result),
      pendingPayout,
      grossAmount: toNumber(row.gross),
      refunds: toNumber(row.refunds),
      taxWithheld: toNumber(row.tax_withheld),
      settlementStatus: row.status,
      payoutStatus: row.payout_status || null,
      lastPayoutDate: row.payout_paid_at || null,
      status: deriveStatusLabel({
        open_settlements: unsettled ? 1 : 0,
        processing_payouts: row.payout_status === 'processing' ? 1 : 0,
        paid_payouts: row.payout_status === 'paid' ? 1 : 0,
        pending_payouts:
          row.payout_status && row.payout_status !== 'paid'
            ? 1
            : 0,
      }),
    };
  });

  return {
    restaurantId,
    period: { start: start.toISOString(), end: end.toISOString() },
    branches,
  };
}

async function listRestaurantSettlements({
  restaurantId,
  branchId = null,
  status = null,
  search = null,
  period = null,
  range = null,
  startDate,
  endDate,
} = {}) {
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }
  const { start, end } = resolvePeriodRange({ period: period || range, startDate, endDate });
  const params = [
    restaurantId,
    branchId || null,
    start ? start.toISOString().slice(0, 10) : null,
    end ? end.toISOString().slice(0, 10) : null,
    status && status !== 'all' ? status : null,
    search ? search.trim().toLowerCase() : null,
  ];

  const query = `
    SELECT
      rs.*,
      p.id           AS payout_id,
      p.status       AS payout_status,
      p.paid_at,
      COUNT(DISTINCT CASE WHEN rsi.item_type = 'payment' THEN rsi.order_id END) AS order_count,
      COALESCE(SUM(CASE WHEN rsi.item_type = 'payment'
        THEN COALESCE((rsi.meta->>'shipping_fee')::numeric, 0)
        ELSE 0 END), 0) AS shipping_total
    FROM restaurant_settlements rs
    LEFT JOIN restaurant_settlement_items rsi ON rsi.settlement_id = rs.id
    LEFT JOIN payouts p ON p.settlement_id = rs.id
    WHERE rs.restaurant_id = $1
      AND ($2::uuid IS NULL OR rs.branch_id = $2)
      AND ($3::date IS NULL OR rs.period_start >= $3)
      AND ($4::date IS NULL OR rs.period_end <= $4)
      AND ($5::text IS NULL OR LOWER(rs.status) = LOWER($5))
      AND (
        $6::text IS NULL OR
        p.id::text ILIKE '%' || $6 || '%' OR
        to_char(rs.period_end, 'YYYYMMDD') ILIKE '%' || $6 || '%'
      )
    GROUP BY rs.id, p.id
    ORDER BY rs.period_end DESC
  `;

  const { rows } = await pool.query(query, params);
  const shippingCache = new Map();
  const fallbackShippingMap = await buildFallbackShippingTotals(rows, shippingCache);

  const summary = rows.reduce(
    (acc, row) => {
      const gross = toNumber(row.gross);
      const vat = toNumber(row.tax_withheld);
      const refunds = toNumber(row.refunds);
      const shipping =
        toNumber(row.shipping_total) || toNumber(fallbackShippingMap.get(row.id)) || 0;
      acc.totalOnlineSales += gross;
      acc.totalVat += vat;
      acc.totalRefunds += refunds;
      acc.totalShipping += shipping;
      acc.totalOrders += Number(row.order_count || 0);
      return acc;
    },
    { totalOnlineSales: 0, totalVat: 0, totalRefunds: 0, totalShipping: 0, totalOrders: 0 },
  );

  const settlements = rows.map((row) => {
    const shippingTotal =
      toNumber(row.shipping_total) || toNumber(fallbackShippingMap.get(row.id)) || 0;
    const grossSales = toNumber(row.gross);
    const vat = toNumber(row.tax_withheld);
    const refunds = toNumber(row.refunds);
    const netBase = toNumber(row.net_result);
    const cycleLabel = buildCycleLabel(row.period_start, row.period_end);
    const payoutCode = row.payout_id
      ? row.payout_id
      : row.period_end
        ? `PAYOUT-${new Date(row.period_end).toISOString().slice(0, 10).replace(/-/g, '')}`
        : null;
    return {
      settlementId: row.id,
      restaurantId: row.restaurant_id,
      branchId: row.branch_id,
      payoutId: row.payout_id,
      payoutCode,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      cycleLabel,
      status: row.status,
      payoutStatus: row.payout_status,
      payoutDate: row.paid_at,
      grossSales,
      vat,
      refunds,
      deliveryFeeTotal: shippingTotal,
      netAmount: netBase,
      totalOrders: Number(row.order_count || 0),
    };
  });

  const netEarnings = summary.totalOnlineSales - summary.totalVat - summary.totalShipping - summary.totalRefunds;

  return {
    period: {
      start: start ? start.toISOString() : null,
      end: end ? end.toISOString() : null,
    },
    summary: {
      totalOnlineSales: summary.totalOnlineSales,
      totalVat: summary.totalVat,
      netEarnings,
      shippingFees: summary.totalShipping,
      refunds: summary.totalRefunds,
      totalOrders: summary.totalOrders,
    },
    settlements,
  };
}

async function listSettlementOrders(settlementId, { restaurantId = null } = {}) {
  if (!settlementId) {
    throw new Error('settlementId is required');
  }

  const settlementRes = await pool.query(
    'SELECT * FROM restaurant_settlements WHERE id = $1 LIMIT 1',
    [settlementId],
  );
  const settlement = settlementRes.rows[0];
  if (!settlement) {
    return null;
  }
  if (restaurantId && settlement.restaurant_id !== restaurantId) {
    return null;
  }

  const itemsRes = await pool.query(
    `
      SELECT
        item.id,
        item.order_id,
        item.payment_id,
        item.amount,
        item.meta,
        item.created_at,
        p.paid_at,
        p.status AS payment_status,
        p.currency AS payment_currency,
        pm.type AS method_type,
        pm.provider AS method_provider,
        pm.brand AS method_brand,
        pm.last4 AS method_last4,
        COALESCE(tax.tax_amount, 0) AS tax_amount
      FROM restaurant_settlement_items item
      LEFT JOIN payments p ON p.id = item.payment_id
      LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) AS tax_amount
        FROM payment_fee_components f
        WHERE f.payment_id = item.payment_id
          AND f.component_type = 'tax_withheld'
      ) tax ON TRUE
      WHERE item.settlement_id = $1 AND item.item_type = 'payment'
      ORDER BY item.created_at DESC
    `,
    [settlementId],
  );

  const payoutStatusRes = await pool.query(
    'SELECT status FROM payouts WHERE settlement_id = $1 LIMIT 1',
    [settlementId],
  );
  const payoutStatus = payoutStatusRes.rows[0]?.status || null;
  const rowStatus = deriveOrderStatus(settlement.status, payoutStatus);

  const shippingCache = new Map();
  const orders = await Promise.all(
    itemsRes.rows.map(async (row) => {
      let meta = row.meta;
      if (meta && typeof meta !== 'object') {
        try {
          meta = JSON.parse(meta);
        } catch {
          meta = {};
        }
      }
      meta = meta || {};
      const vat = toNumber(row.tax_amount || meta.tax);
      let deliveryFee = toNumber(meta.shipping_fee || meta.delivery_fee);
      if (!deliveryFee && row.order_id) {
        deliveryFee = await resolveShippingFeeForOrder(row.order_id, shippingCache);
      }
      const orderDate = meta.order_completed_at || row.paid_at || row.created_at;
      const paymentMethodKey = (row.method_provider || row.method_type || '').toLowerCase();
      const methodLabel = row.method_provider
        ? `${row.method_provider}${row.method_brand ? ` ${row.method_brand}` : ''}`
        : row.method_type || 'online';
      const maskedMethod = row.method_last4 ? `${methodLabel} •••• ${row.method_last4}` : methodLabel;
      return {
        settlementItemId: row.id,
        orderId: row.order_id,
        paymentId: row.payment_id,
        totalSales: toNumber(row.amount),
        vat,
        deliveryFee,
        netPayout: toNumber(row.amount) - vat - deliveryFee,
        orderDate,
        paymentMethod: {
          provider: row.method_provider,
          type: row.method_type,
          brand: row.method_brand,
          last4: row.method_last4,
          label: maskedMethod,
          key: paymentMethodKey,
        },
        status: rowStatus,
        currency: row.payment_currency || settlement.currency || 'VND',
        branchId: settlement.branch_id,
      };
    }),
  );

  const aggregates = orders.reduce(
    (acc, order) => {
      acc.totalSales += order.totalSales;
      acc.vat += order.vat;
      acc.netPayout += order.netPayout;
      acc.deliveryFee += order.deliveryFee;
      acc.count += 1;
      return acc;
    },
    { totalSales: 0, vat: 0, netPayout: 0, deliveryFee: 0, count: 0 },
  );

  return {
    settlement: {
      id: settlement.id,
      restaurantId: settlement.restaurant_id,
      branchId: settlement.branch_id,
      periodStart: settlement.period_start,
      periodEnd: settlement.period_end,
      status: settlement.status,
      payoutStatus,
      currency: settlement.currency,
    },
    orders,
    totals: aggregates,
  };
}

module.exports = {
  listRestaurantPayouts,
  listRestaurantBranchSettlements,
  listRestaurantSettlements,
  listSettlementOrders,
};
