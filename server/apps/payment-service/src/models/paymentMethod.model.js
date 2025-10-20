const { pool } = require('./payment.model');

const BANK_ACCOUNT_TYPE = 'bank_account';

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
};
