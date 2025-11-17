const { pool } = require('../models/payment.model');
const { fetchOrderById } = require('../clients/order.client');
const orderStatusModel = require('../models/orderStatus.model');

const PERIOD_DAYS = 7;
const DAY_MS = 86400000;

const toAmount = (value) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const toDateOnly = (value) => {
  const source = value ? new Date(value) : new Date();
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
};

const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'object') return { ...metadata };
  try {
    return JSON.parse(metadata);
  } catch (err) {
    return {};
  }
};

const fetchOrderFromDatabase = async (orderId, stage = 'settlement') => {
  if (!orderId) return null;
  try {
    return await orderStatusModel.fetchOrderSnapshot(orderId);
  } catch (error) {
    console.warn(
      `[payment-service] Unable to fetch order from DB for ${stage}:`,
      error?.message || error,
    );
    return null;
  }
};

const loadOrderForSettlement = async (orderId, stage = 'settlement') => {
  if (!orderId) return null;
  let order = null;
  try {
    order = await fetchOrderById(orderId);
  } catch (error) {
    console.warn(
      `[payment-service] Unable to fetch order via API for ${stage}:`,
      error?.message || error,
    );
  }

  if (order && order.restaurant_id && order.branch_id) {
    return order;
  }

  const fallback = await fetchOrderFromDatabase(orderId, stage);
  if (!fallback && !order) {
    return null;
  }
  if (!order) {
    return fallback;
  }
  if (!fallback) {
    return order;
  }

  const merged = { ...order };
  if (!merged.restaurant_id && fallback.restaurant_id) {
    merged.restaurant_id = fallback.restaurant_id;
  }
  if (!merged.branch_id && fallback.branch_id) {
    merged.branch_id = fallback.branch_id;
  }
  if (merged.total_amount === undefined && fallback.total_amount !== undefined) {
    merged.total_amount = fallback.total_amount;
  }
  if (merged.tax_total === undefined && fallback.tax_total !== undefined) {
    merged.tax_total = fallback.tax_total;
  }
  if (merged.shipping_fee === undefined && fallback.shipping_fee !== undefined) {
    merged.shipping_fee = fallback.shipping_fee;
  }
  if (!merged.currency && fallback.currency) {
    merged.currency = fallback.currency;
  }
  if (!merged.metadata && fallback.metadata) {
    merged.metadata = fallback.metadata;
  }
  return merged;
};

const resolveRestaurantContext = (order = {}) => {
  const metadata = parseMetadata(order.metadata);
  const restaurantId =
    order.restaurant_id ||
    order.restaurantId ||
    metadata.restaurant_id ||
    metadata.restaurantId ||
    metadata.restaurant_snapshot?.id ||
    null;
  const branchId =
    order.branch_id ||
    order.branchId ||
    metadata.branch_id ||
    metadata.branchId ||
    metadata.branch_snapshot?.id ||
    (Array.isArray(metadata.branch_ids) && metadata.branch_ids.length === 1
      ? metadata.branch_ids[0]
      : null);
  return { restaurantId, branchId };
};

let settlementSchemaReady = false;
let settlementSchemaPromise = null;
const ensureSettlementSchema = async () => {
  if (settlementSchemaReady) {
    return;
  }
  if (!settlementSchemaPromise) {
    settlementSchemaPromise = (async () => {
      const [shippingColumnCheck, adminColumnCheck] = await Promise.all([
        pool.query(
          `
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'restaurant_settlements'
               AND column_name = 'shipping_fees'
             LIMIT 1
          `,
        ),
        pool.query(
          `
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'restaurant_settlement_items'
               AND column_name = 'is_admin_only'
             LIMIT 1
          `,
        ),
      ]);
      const shippingColumnMissing = shippingColumnCheck.rowCount === 0;
      if (shippingColumnMissing) {
        await pool.query(
          `
            ALTER TABLE restaurant_settlements
              ADD COLUMN IF NOT EXISTS shipping_fees NUMERIC(12,2) NOT NULL DEFAULT 0
          `,
        );
        await pool.query(
          `
            WITH shipping AS (
              SELECT
                settlement_id,
                COALESCE(SUM(COALESCE((meta->>'shipping_fee')::numeric, 0)), 0) AS shipping_total
              FROM restaurant_settlement_items
              WHERE item_type = 'payment'
              GROUP BY settlement_id
            )
            UPDATE restaurant_settlements rs
               SET shipping_fees = shipping.shipping_total,
                   net_result = rs.gross - rs.refunds - rs.tax_withheld - shipping.shipping_total,
                   updated_at = now()
              FROM shipping
             WHERE rs.id = shipping.settlement_id
          `,
        );
      }

      const adminColumnMissing = adminColumnCheck.rowCount === 0;
      if (adminColumnMissing) {
        await pool.query(
          `
            ALTER TABLE restaurant_settlement_items
              ADD COLUMN IF NOT EXISTS is_admin_only BOOLEAN NOT NULL DEFAULT FALSE
          `,
        );
      }

      settlementSchemaReady = true;
    })().catch((error) => {
      settlementSchemaPromise = null;
      throw error;
    });
  }
  await settlementSchemaPromise;
};

const selectSettlementForDate = async (client, branchId, targetDate) => {
  const queryDate = toDateOnly(targetDate);
  const res = await client.query(
    `
      SELECT *
        FROM restaurant_settlements
       WHERE branch_id = $1
         AND period_start <= $2
         AND period_end > $2
       ORDER BY period_start DESC
       LIMIT 1
    `,
    [branchId, queryDate],
  );
  return res.rows[0] || null;
};

const createSettlement = async (client, { restaurantId, branchId, completedAt, currency = 'VND' }) => {
  const periodStart = toDateOnly(completedAt);
  const periodEnd = new Date(periodStart.getTime() + PERIOD_DAYS * DAY_MS);
  const res = await client.query(
    `
      INSERT INTO restaurant_settlements (
        restaurant_id,
        branch_id,
        period_start,
        period_end,
        currency,
        status
      ) VALUES ($1,$2,$3,$4,$5,'open')
      RETURNING *
    `,
    [restaurantId, branchId, periodStart, periodEnd, currency],
  );
  return res.rows[0];
};

const resolveSettlementStatus = (settlement) => {
  if (!settlement) return 'open';
  const now = new Date();
  const periodEnd = new Date(settlement.period_end);
  const dayBeforeEnd = new Date(periodEnd.getTime() - DAY_MS);
  if (['invoiced', 'closed'].includes(settlement.status)) {
    return settlement.status;
  }
  if (now >= periodEnd) {
    return 'payout_scheduled';
  }
  if (now >= dayBeforeEnd && settlement.status === 'open') {
    return 'ready';
  }
  return settlement.status;
};

const ensureSettlement = async (client, context) => {
  const existing = await selectSettlementForDate(client, context.branchId, context.completedAt);
  if (existing) {
    return existing;
  }
  return createSettlement(client, context);
};

const findLatestPaymentForOrder = async (client, orderId) => {
  const res = await client.query(
    `
      SELECT p.*
        FROM payments p
        JOIN order_payments op ON op.payment_id = p.id
       WHERE op.order_id = $1
       ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
       LIMIT 1
    `,
    [orderId],
  );
  return res.rows[0] || null;
};

const resolvePayoutAccountId = async (client, { branchId, restaurantId }) => {
  if (!branchId && !restaurantId) return null;
  if (branchId) {
    const byBranch = await client.query(
      `
        SELECT id
          FROM restaurant_payout_accounts
         WHERE branch_id = $1
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1
      `,
      [branchId],
    );
    if (byBranch.rows[0]) {
      return byBranch.rows[0].id;
    }
  }

  if (restaurantId) {
    const byRestaurant = await client.query(
      `
        SELECT id
          FROM restaurant_payout_accounts
         WHERE restaurant_id = $1
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1
      `,
      [restaurantId],
    );
    if (byRestaurant.rows[0]) {
      return byRestaurant.rows[0].id;
    }
  }
  return null;
};

const resolvePlatformBankAccountId = async (client) => {
  const res = await client.query(
    `
      SELECT id
        FROM platform_bank_accounts
       WHERE is_active = TRUE
       ORDER BY is_primary DESC, created_at ASC
       LIMIT 1
    `,
  );
  return res.rows[0]?.id || null;
};

const ensurePayoutForSettlement = async (client, settlement) => {
  if (!settlement) {
    return null;
  }

  const existing = await client.query(
    `
      SELECT *
        FROM payouts
       WHERE settlement_id = $1
       LIMIT 1
    `,
    [settlement.id],
  );

  if (settlement.net_result <= 0) {
    if (existing.rows[0]) {
      const updated = await client.query(
        `UPDATE payouts SET amount = $1, currency = $2 WHERE id = $3 RETURNING *`,
        [settlement.net_result, settlement.currency || 'VND', existing.rows[0].id],
      );
      return updated.rows[0];
    }
    return null;
  }

  const payoutAccountId = await resolvePayoutAccountId(client, {
    branchId: settlement.branch_id,
    restaurantId: settlement.restaurant_id,
  });
  if (!payoutAccountId) {
    console.warn('[payment-service] No payout account configured for branch', settlement.branch_id);
    return existing.rows[0] || null;
  }

  if (existing.rows[0]) {
    const updated = await client.query(
      `
        UPDATE payouts
           SET amount = $1,
               currency = $2,
               branch_id = $3,
               payout_account_id = $4
         WHERE id = $5
         RETURNING *
      `,
      [settlement.net_result, settlement.currency || 'VND', settlement.branch_id, payoutAccountId, existing.rows[0].id],
    );
    return updated.rows[0];
  }

  const inserted = await client.query(
    `
      INSERT INTO payouts (
        settlement_id,
        branch_id,
        payout_account_id,
        amount,
        currency,
        status
      ) VALUES ($1,$2,$3,$4,$5,'pending')
      RETURNING *
    `,
    [settlement.id, settlement.branch_id, payoutAccountId, settlement.net_result, settlement.currency || 'VND'],
  );
  return inserted.rows[0];
};

const insertSettlementItem = async (
  client,
  {
    settlementId,
    type,
    paymentId = null,
    refundId = null,
    branchId,
    orderId,
    amount,
    meta,
    isAdminOnly = false,
  },
) => {
  await client.query(
    `
      INSERT INTO restaurant_settlement_items (
        settlement_id,
        item_type,
        payment_id,
        refund_id,
        branch_id,
        order_id,
        amount,
        meta,
        is_admin_only
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      settlementId,
      type,
      paymentId,
      refundId,
      branchId,
      orderId,
      amount,
      meta ? JSON.stringify(meta) : null,
      Boolean(isAdminOnly),
    ],
  );
};

const hasPaymentSettlementItem = async (client, orderId) => {
  if (!orderId) return false;
  const res = await client.query(
    `
      SELECT 1
        FROM restaurant_settlement_items
       WHERE order_id = $1
         AND item_type = 'payment'
       LIMIT 1
    `,
    [orderId],
  );
  return Boolean(res.rows[0]);
};

const findPaymentSettlementItem = async (client, orderId) => {
  if (!orderId) return null;
  const res = await client.query(
    `
      SELECT *
        FROM restaurant_settlement_items
       WHERE order_id = $1
         AND item_type = 'payment'
       ORDER BY created_at DESC
       LIMIT 1
    `,
    [orderId],
  );
  return res.rows[0] || null;
};

const updateSettlementItem = async (client, itemId, { isAdminOnly, amount, meta } = {}) => {
  if (!itemId) return null;
  const res = await client.query(
    `
      UPDATE restaurant_settlement_items
         SET is_admin_only = COALESCE($2, is_admin_only),
             amount = COALESCE($3, amount),
             meta = COALESCE($4, meta)
       WHERE id = $1
       RETURNING *
    `,
    [
      itemId,
      typeof isAdminOnly === 'boolean' ? isAdminOnly : null,
      amount !== undefined ? amount : null,
      meta ? JSON.stringify(meta) : null,
    ],
  );
  return res.rows[0] || null;
};

const extractOrderFinancials = (order = {}) => {
  const metadata = parseMetadata(order.metadata);
  const pricing = metadata.pricing && typeof metadata.pricing === 'object' ? metadata.pricing : {};
  const amount = toAmount(order.total_amount ?? pricing.total_amount ?? pricing.total ?? 0);
  const taxAmount = toAmount(order.tax_total ?? pricing.tax_total ?? 0);
  const shippingFee = toAmount(
    order.shipping_fee ??
      pricing.shipping_fee ??
      pricing.shippingFee ??
      (pricing.totals ? pricing.totals.shipping_fee ?? pricing.totals.shippingFee : 0) ??
      0,
  );
  const currency = order.currency || pricing.currency || 'VND';
  const completedAt =
    order.completed_at ||
    order.confirmed_at ||
    order.updated_at ||
    order.created_at ||
    new Date();
  const placedAt = order.created_at || order.createdAt || completedAt;
  return { metadata, pricing, amount, taxAmount, shippingFee, currency, completedAt, placedAt };
};

const updateLedgerBalance = async (client, platformBankAccountId, amount, currency) => {
  if (!platformBankAccountId || !amount) return;
  await client.query(
    `
      INSERT INTO platform_ledger_balances (
        platform_bank_account_id,
        current_balance,
        currency,
        last_updated_at
      ) VALUES ($1,$2,$3,now())
      ON CONFLICT (platform_bank_account_id)
      DO UPDATE SET
        current_balance = platform_ledger_balances.current_balance + EXCLUDED.current_balance,
        last_updated_at = now()
    `,
    [platformBankAccountId, -amount, currency || 'VND'],
  );
};

const recordPayoutTransaction = async (client, payout) => {
  if (!payout || payout.status !== 'paid') return;
  await client.query(
    `
      INSERT INTO platform_transactions (
        payment_id,
        payout_id,
        refund_id,
        platform_bank_account_id,
        restaurant_payout_account_id,
        txn_type,
        source,
        description,
        amount,
        currency,
        status
      ) VALUES (NULL,$1,NULL,$2,$3,'outflow_payout','BankTransfer',$4,$5,$6,'completed')
    `,
    [
      payout.id,
      payout.platform_bank_account_id,
      payout.payout_account_id,
      `Payout settlement #${payout.settlement_id}`,
      payout.amount,
      payout.currency || 'VND',
    ],
  );
};

const finalisePayoutIfDue = async (client, settlement, payout) => {
  if (!settlement || !payout || settlement.net_result <= 0) {
    return;
  }

  if (payout.status === 'paid' || settlement.status !== 'payout_scheduled') {
    return;
  }

  const now = new Date();
  const periodEnd = new Date(settlement.period_end);
  if (now < periodEnd) {
    return;
  }

  const platformBankAccountId =
    payout.platform_bank_account_id || (await resolvePlatformBankAccountId(client));
  if (!platformBankAccountId) {
    return;
  }

  const transactionRef =
    payout.transaction_ref || `STL-${settlement.id.substring(0, 8)}-${Date.now()}`;

  const updated = await client.query(
    `
      UPDATE payouts
         SET status = 'paid',
             platform_bank_account_id = $1,
             transaction_ref = $2,
             paid_at = now()
       WHERE id = $3
       RETURNING *
    `,
    [platformBankAccountId, transactionRef, payout.id],
  );

  const finalPayout = updated.rows[0];
  if (!finalPayout) {
    return;
  }

  await recordPayoutTransaction(client, finalPayout);
  await updateLedgerBalance(client, platformBankAccountId, finalPayout.amount, finalPayout.currency);
  await client.query(
    `UPDATE restaurant_settlements SET status = 'invoiced', updated_at = now() WHERE id = $1`,
    [settlement.id],
  );
};

const applySettlementDelta = async (
  client,
  settlement,
  { grossDelta = 0, refundDelta = 0, taxDelta = 0, shippingDelta = 0 },
) => {
  await ensureSettlementSchema();
  const nextGross = toAmount(settlement.gross) + grossDelta;
  const nextRefunds = toAmount(settlement.refunds) + refundDelta;
  const nextTax = toAmount(settlement.tax_withheld) + taxDelta;
  const currentShipping = 'shipping_fees' in settlement ? toAmount(settlement.shipping_fees) : 0;
  const nextShipping = currentShipping + shippingDelta;
  const nextNet = nextGross - nextRefunds - nextTax - nextShipping;
  const status = resolveSettlementStatus(settlement);

  const res = await client.query(
    `
      UPDATE restaurant_settlements
         SET gross = $1,
             refunds = $2,
             tax_withheld = $3,
             shipping_fees = $4,
             net_result = $5,
             status = $6,
             updated_at = now()
       WHERE id = $7
       RETURNING *
    `,
    [nextGross, nextRefunds, nextTax, nextShipping, nextNet, status, settlement.id],
  );
  return res.rows[0];
};

async function recordOrderCompletion(orderId) {
  if (!orderId) return;
  await ensureSettlementSchema();
  const order = await loadOrderForSettlement(orderId, 'settlement-completion');
  if (!order) {
    console.warn('[payment-service] Missing order context for completion settlement', orderId);
    return;
  }

  const { restaurantId, branchId } = resolveRestaurantContext(order);
  if (!branchId || !restaurantId) {
    console.warn('[payment-service] Missing branch/restaurant context for order', orderId);
    return;
  }

  const { amount, taxAmount, shippingFee, currency, completedAt } = extractOrderFinancials(order);
  if (!amount) {
    return;
  }
  const orderCompletedAt =
    order.completed_at ||
    order.confirmed_at ||
    order.updated_at ||
    order.created_at ||
    new Date();
  const orderCode = order.order_code || order.code || order.short_id || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let settlement = await ensureSettlement(client, {
      restaurantId,
      branchId,
      completedAt,
      currency,
    });

    const existingItem = await findPaymentSettlementItem(client, order.id);
    if (existingItem) {
      const existingMeta = parseMetadata(existingItem.meta);
      const existingAmount = toAmount(existingItem.amount);
      const existingTax = toAmount(existingMeta?.tax);
      const existingShipping = toAmount(
        existingMeta?.shipping_fee ?? existingMeta?.delivery_fee ?? 0,
      );
      const amountDelta = toAmount(amount - existingAmount);
      const taxDelta = toAmount(taxAmount - existingTax);
      const shippingDelta = toAmount(shippingFee - existingShipping);
      if (amountDelta || taxDelta || shippingDelta) {
        settlement = await applySettlementDelta(client, settlement, {
          grossDelta: amountDelta,
          taxDelta,
          shippingDelta,
        });
      }
      await updateSettlementItem(client, existingItem.id, {
        isAdminOnly: false,
        amount,
        meta: {
          currency,
          tax: taxAmount,
          shipping_fee: shippingFee,
          order_completed_at: orderCompletedAt,
          order_code: orderCode,
          source: 'order_completed',
        },
      });
    } else {
      // Fallback: if provisional item was not created at pending stage,
      // create a proper item now so admin/restaurant can reconcile orders.
      settlement = await applySettlementDelta(client, settlement, {
        grossDelta: amount,
        taxDelta: taxAmount,
        shippingDelta: shippingFee,
      });

      const payment = await findLatestPaymentForOrder(client, order.id);
      await insertSettlementItem(client, {
        settlementId: settlement.id,
        type: 'payment',
        paymentId: payment?.id || null,
        refundId: null,
        branchId,
        orderId: order.id,
        amount,
        meta: {
          currency,
          tax: taxAmount,
          shipping_fee: shippingFee,
          order_completed_at: orderCompletedAt,
          order_code: orderCode,
          source: 'order_completed_fallback',
        },
        isAdminOnly: false,
      });
    }

    const payout = await ensurePayoutForSettlement(client, settlement);
    await finalisePayoutIfDue(client, settlement, payout);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[payment-service] Failed to record order completion into settlement:', error);
  } finally {
    client.release();
  }
}

async function recordOrderPlacement(orderId) {
  if (!orderId) return;
  await ensureSettlementSchema();
  const order = await loadOrderForSettlement(orderId, 'settlement-placement');
  if (!order) {
    console.warn('[payment-service] Missing order context for provisional settlement', orderId);
    return;
  }

  const { restaurantId, branchId } = resolveRestaurantContext(order);
  if (!branchId || !restaurantId) {
    console.warn('[payment-service] Missing branch/restaurant context for provisional order', orderId);
    return;
  }

  const { amount, taxAmount, shippingFee, currency, placedAt } = extractOrderFinancials(order);
  if (!amount) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let settlement = await ensureSettlement(client, {
      restaurantId,
      branchId,
      completedAt: placedAt,
      currency,
    });

    const existingItem = await findPaymentSettlementItem(client, order.id);
    if (existingItem) {
      await client.query('ROLLBACK');
      return;
    }

    settlement = await applySettlementDelta(client, settlement, {
      grossDelta: amount,
      taxDelta: taxAmount,
      shippingDelta: shippingFee,
    });

    await insertSettlementItem(client, {
      settlementId: settlement.id,
      type: 'payment',
      paymentId: null,
      refundId: null,
      branchId,
      orderId: order.id,
      amount,
      meta: {
        currency,
        tax: taxAmount,
        shipping_fee: shippingFee,
        stage: 'order_placed',
      },
      isAdminOnly: true,
    });

    const payout = await ensurePayoutForSettlement(client, settlement);
    await finalisePayoutIfDue(client, settlement, payout);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[payment-service] Failed to record order placement into settlement:', error);
  } finally {
    client.release();
  }
}

async function recordRefund(refund, payment) {
  if (!refund || !payment) return;
  await ensureSettlementSchema();
  const branchId = payment.branch_id;
  const restaurantId = payment.restaurant_id;
  if (!branchId || !restaurantId) {
    return;
  }

  const amount = toAmount(refund.amount);
  if (!amount) {
    return;
  }
  const currency = payment.currency || 'VND';
  const occurredAt = refund.processed_at || refund.created_at || new Date();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let settlement = await ensureSettlement(client, {
      restaurantId,
      branchId,
      completedAt: occurredAt,
      currency,
    });

    const orderHadPaymentItem = await hasPaymentSettlementItem(client, payment.order_id);

    if (orderHadPaymentItem) {
      settlement = await applySettlementDelta(client, settlement, {
        refundDelta: amount,
      });

      await insertSettlementItem(client, {
        settlementId: settlement.id,
        type: 'refund',
        paymentId: payment.id,
        refundId: refund.id,
        branchId,
        orderId: payment.order_id,
        amount: -amount,
        meta: {
          currency,
          source: 'refund',
        },
        isAdminOnly: false,
      });

      const payout = await ensurePayoutForSettlement(client, settlement);
      await finalisePayoutIfDue(client, settlement, payout);
    } else {
      await insertSettlementItem(client, {
        settlementId: settlement.id,
        type: 'adjustment',
        paymentId: payment.id,
        refundId: refund.id,
        branchId,
        orderId: payment.order_id,
        amount: -amount,
        meta: {
          currency,
          source: 'cancelled_before_completion',
        },
        isAdminOnly: true,
      });
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[payment-service] Failed to record refund in settlement:', error);
  } finally {
    client.release();
  }
}

module.exports = {
  recordOrderCompletion,
  recordOrderPlacement,
  recordRefund,
  runSettlementJob: async () => {},
};
