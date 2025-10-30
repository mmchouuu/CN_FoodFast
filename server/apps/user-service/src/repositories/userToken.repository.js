const { pool } = require('../db');
const bcrypt = require('../utils/bcrypt');

function getExecutor(client) {
  return client || pool;
}

async function createToken({ userId, purpose, code, ttlMs, channel = 'email' }, client) {
  const executor = getExecutor(client);
  const expiresAt = new Date(Date.now() + ttlMs);
  const codeHash = await bcrypt.hash(code);

  await executor.query(
    `
      WITH updated AS (
        UPDATE user_tokens
        SET
          code_hash = $3,
          expires_at = $4,
          consumed_at = NULL,
          channel = $5
        WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
        RETURNING id
      )
      INSERT INTO user_tokens (
        user_id,
        purpose,
        channel,
        code_hash,
        expires_at
      )
      SELECT $1, $2, $5, $3, $4
      WHERE NOT EXISTS (SELECT 1 FROM updated)
    `,
    [userId, purpose, codeHash, expiresAt, channel],
  );

  return { expiresAt };
}

async function consumeToken({ userId, purpose, code }, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM user_tokens
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `,
    [userId, purpose],
  );

  const record = result.rows[0];
  if (!record) {
    return { success: false, reason: 'not_found' };
  }

  const matches = await bcrypt.compare(code, record.code_hash);
  if (!matches) {
    return { success: false, reason: 'invalid_code' };
  }

  await executor.query(
    `
      UPDATE user_tokens
      SET consumed_at = now()
      WHERE id = $1
    `,
    [record.id],
  );

  return { success: true, token: record };
}

module.exports = {
  createToken,
  consumeToken,
};
