const { pool } = require('../models/payment.model');
const { fetchOrderById } = require('../clients/order.client');

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
  { settlementId, type, paymentId = null, refundId = null, branchId, orderId, amount, meta },
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
        meta
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [settlementId, type, paymentId, refundId, branchId, orderId, amount, meta ? JSON.stringify(meta) : null],
  );
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
  { grossDelta = 0, refundDelta = 0, taxDelta = 0 },
) => {
  const nextGross = toAmount(settlement.gross) + grossDelta;
  const nextRefunds = toAmount(settlement.refunds) + refundDelta;
  const nextTax = toAmount(settlement.tax_withheld) + taxDelta;
  const nextNet = nextGross - nextRefunds - nextTax;
  const status = resolveSettlementStatus(settlement);

  const res = await client.query(
    `
      UPDATE restaurant_settlements
         SET gross = $1,
             refunds = $2,
             tax_withheld = $3,
             net_result = $4,
             status = $5,
             updated_at = now()
       WHERE id = $6
       RETURNING *
    `,
    [nextGross, nextRefunds, nextTax, nextNet, status, settlement.id],
  );
  return res.rows[0];
};

async function recordOrderCompletion(orderId) {
  if (!orderId) return;
  let order;
  try {
    order = await fetchOrderById(orderId);
  } catch (error) {
    console.warn('[payment-service] Unable to fetch order for settlement', error.message || error);
    return;
  }
  if (!order) return;

  const { restaurantId, branchId } = resolveRestaurantContext(order);
  if (!branchId || !restaurantId) {
    console.warn('[payment-service] Missing branch/restaurant context for order', orderId);
    return;
  }

  const metadata = parseMetadata(order.metadata);
  const pricing = metadata.pricing && typeof metadata.pricing === 'object' ? metadata.pricing : {};
  const amount = toAmount(order.total_amount ?? pricing.total_amount ?? pricing.total ?? 0);
  if (!amount) {
    return;
  }
  const taxAmount = toAmount(order.tax_total ?? pricing.tax_total ?? 0);
  const shippingSource =
    order.shipping_fee ??
    pricing.shipping_fee ??
    pricing.shippingFee ??
    (pricing.totals
      ? pricing.totals.shipping_fee ?? pricing.totals.shippingFee ?? null
      : null);
  const shippingFee = toAmount(shippingSource ?? 0);
  const orderCompletedAt =
    order.completed_at ||
    order.confirmed_at ||
    order.updated_at ||
    order.created_at ||
    new Date();
  const orderCode = order.order_code || order.code || order.short_id || null;
  const currency = order.currency || pricing.currency || 'VND';
  const completedAt = order.updated_at || new Date();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let settlement = await ensureSettlement(client, {
      restaurantId,
      branchId,
      completedAt,
      currency,
    });

    settlement = await applySettlementDelta(client, settlement, {
      grossDelta: amount,
      taxDelta: taxAmount,
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
        source: 'order_completed',
      },
    });

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

async function recordRefund(refund, payment) {
  if (!refund || !payment) return;
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
    });

    const payout = await ensurePayoutForSettlement(client, settlement);
    await finalisePayoutIfDue(client, settlement, payout);
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
  recordRefund,
  runSettlementJob: async () => {},
};
