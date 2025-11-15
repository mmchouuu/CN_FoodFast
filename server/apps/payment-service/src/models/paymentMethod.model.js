// payment-service/src/models/paymentMethod.model,js

const { pool } = require('./payment.model');
const WALLET_TYPE = 'wallet';
const CARD_TYPE = 'card';
const STRIPE_PROVIDER = 'stripe';
const MOMO_PROVIDER = 'momo';

async function findPaymentMethodById(id, userId = null) {
  if (!id) return null;
  const result = await pool.query(
    `SELECT id,
            user_id,
            type,
            provider,
            provider_data,
            last4,
            brand,
            exp_month,
            exp_year,
            is_default,
            created_at
       FROM payment_methods
      WHERE id = $1
        AND ($2::uuid IS NULL OR user_id = $2)
      LIMIT 1`,
    [id, userId || null],
  );
  return result.rows[0] || null;
}

async function findPaymentMethodByProviderPaymentId(providerPaymentId, userId = null) {
  if (!providerPaymentId) return null;
  const result = await pool.query(
    `SELECT id,
            user_id,
            type,
            provider,
            provider_data,
            last4,
            brand,
            exp_month,
            exp_year,
            is_default,
            created_at
       FROM payment_methods
      WHERE provider_data ->> 'payment_method_id' = $1
        AND ($2::uuid IS NULL OR user_id = $2)
      LIMIT 1`,
    [providerPaymentId, userId || null],
  );
  return result.rows[0] || null;
}

async function listMomoWallets(userId) {
  const result = await pool.query(
    `SELECT id,
            user_id,
            provider_data,
            is_default,
            created_at,
            verified_at,
            last4,
            brand
       FROM payment_methods
      WHERE user_id = $1
        AND type = $2
        AND provider = $3
      ORDER BY created_at DESC`,
    [userId, WALLET_TYPE, MOMO_PROVIDER],
  );
  return result.rows;
}

async function createMomoWallet({
  userId,
  displayName,
  phoneNumber,
  walletId,
  isDefault,
  providerData = {},
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (isDefault) {
      await client.query(
        `UPDATE payment_methods
            SET is_default = FALSE
          WHERE user_id = $1
            AND type = $2
            AND provider = $3`,
        [userId, WALLET_TYPE, MOMO_PROVIDER],
      );
    }

    const normalizedPhone = phoneNumber || providerData.phone_number || null;
    if (normalizedPhone) {
      const duplicate = await client.query(
        `SELECT id
           FROM payment_methods
          WHERE user_id = $1
            AND type = $2
            AND provider = $3
            AND provider_data ->> 'phone_number' = $4
          LIMIT 1`,
        [userId, WALLET_TYPE, MOMO_PROVIDER, normalizedPhone],
      );
      if (duplicate.rows[0]) {
        const err = new Error('This MoMo wallet is already linked');
        err.statusCode = 409;
        throw err;
      }
    }

    const payload = {
      display_name: displayName || providerData.display_name || null,
      phone_number: normalizedPhone,
      wallet_id: walletId || providerData.wallet_id || null,
      linked_at: new Date().toISOString(),
      ...providerData,
    };

    const insertResult = await client.query(
      `INSERT INTO payment_methods (
          user_id,
          type,
          provider,
          provider_data,
          brand,
          last4,
          is_default,
          verified_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, FALSE), now())
        RETURNING *`,
      [
        userId,
        WALLET_TYPE,
        MOMO_PROVIDER,
        JSON.stringify(payload),
        'MOMO',
        normalizedPhone ? normalizedPhone.slice(-4) : null,
        isDefault,
      ],
    );

    await client.query('COMMIT');
    return insertResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listMomoWallets,
  createMomoWallet,
  findPaymentMethodById,
  findPaymentMethodByProviderPaymentId,
  async findStripeCustomer(userId) {
    const res = await pool.query(
      `SELECT provider_data
         FROM payment_methods
        WHERE user_id = $1
          AND type = $2
          AND provider = $3
          AND provider_data ->> 'customer_id' IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId, CARD_TYPE, STRIPE_PROVIDER],
    );
    const providerData = res.rows[0]?.provider_data || null;
    if (!providerData) return null;
    return {
      customer_id: providerData.customer_id,
      payment_method_id: providerData.payment_method_id || null,
    };
  },
  async upsertStripeCard({
    userId,
    customerId,
    paymentMethodId,
    last4,
    brand,
    expMonth,
    expYear,
    isDefault = false,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (isDefault) {
        await client.query(
          `UPDATE payment_methods
              SET is_default = FALSE
            WHERE user_id = $1
              AND type = $2
              AND provider = $3`,
          [userId, CARD_TYPE, STRIPE_PROVIDER],
        );
      }

      const insertResult = await client.query(
        `INSERT INTO payment_methods (
            user_id,
            type,
            provider,
            provider_data,
            last4,
            brand,
            exp_month,
            exp_year,
            is_default,
            verified_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, FALSE), now())
          RETURNING *`,
        [
          userId,
          CARD_TYPE,
          STRIPE_PROVIDER,
          JSON.stringify({
            customer_id: customerId,
            payment_method_id: paymentMethodId,
          }),
          last4,
          brand,
          expMonth,
          expYear,
          isDefault,
        ],
      );

      await client.query('COMMIT');
      return insertResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  async listStripePaymentMethods(userId) {
    const res = await pool.query(
      `SELECT id,
              provider_data,
              last4,
              brand,
              exp_month,
              exp_year,
              is_default,
              created_at
         FROM payment_methods
        WHERE user_id = $1
          AND type = $2
          AND provider = $3
        ORDER BY created_at DESC`,
      [userId, CARD_TYPE, STRIPE_PROVIDER],
    );
    return res.rows;
  },
};

