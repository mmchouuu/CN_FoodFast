const { pool } = require('./payment.model');

const BANK_ACCOUNT_TYPE = 'bank_account';
const CARD_TYPE = 'card';
const STRIPE_PROVIDER = 'stripe';

async function listBankAccounts(userId) {
  const result = await pool.query(
    `SELECT id,
            bank_name,
            bank_code,
            account_holder,
            account_number,
            is_default,
            verified_at,
            created_at
       FROM payment_methods
      WHERE user_id = $1
        AND type = $2
      ORDER BY created_at DESC`,
    [userId, BANK_ACCOUNT_TYPE],
  );
  return result.rows;
}

async function createBankAccount({
  userId,
  bankName,
  bankCode,
  accountHolder,
  accountNumber,
  isDefault,
  provider,
  providerData,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (isDefault) {
      await client.query(
        `UPDATE payment_methods
            SET is_default = FALSE
          WHERE user_id = $1
            AND type = $2`,
        [userId, BANK_ACCOUNT_TYPE],
      );
    }

    const insertResult = await client.query(
      `INSERT INTO payment_methods (
          user_id,
          type,
          provider,
          provider_data,
          account_holder,
          account_number,
          bank_name,
          bank_code,
          is_default
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, FALSE))
        RETURNING id,
                  bank_name,
                  bank_code,
                  account_holder,
                  account_number,
                  is_default,
                  verified_at,
                  created_at`,
      [
        userId,
        BANK_ACCOUNT_TYPE,
        provider || 'manual',
        providerData ? JSON.stringify(providerData) : null,
        accountHolder,
        accountNumber,
        bankName,
        bankCode,
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
  listBankAccounts,
  createBankAccount,
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
