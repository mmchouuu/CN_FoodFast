const paymentMethodModel = require('../models/paymentMethod.model');

const ACCOUNT_NUMBER_REGEX = /^[0-9]{6,20}$/;

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function maskAccountNumber(raw) {
  const digits = raw ? String(raw) : '';
  if (digits.length <= 4) {
    return digits;
  }
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

async function listBankAccounts(userId) {
  const rows = await paymentMethodModel.listBankAccounts(userId);
  return rows.map((row) => ({
    id: row.id,
    bankName: row.bank_name,
    bankCode: row.bank_code,
    accountHolder: row.account_holder,
    accountNumberMasked: maskAccountNumber(row.account_number),
    isDefault: row.is_default,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  }));
}

async function createBankAccount(userId, payload) {
  const bankName = sanitizeString(payload.bankName);
  const bankCode = sanitizeString(payload.bankCode).toUpperCase() || null;
  const accountHolder = sanitizeString(payload.accountHolder);
  const accountNumber = sanitizeString(payload.accountNumber).replace(/\s+/g, '');
  const isDefault = payload.isDefault === true;

  if (!bankName) {
    throw Object.assign(new Error('Bank name is required'), { statusCode: 400 });
  }
  if (!accountHolder) {
    throw Object.assign(new Error('Account holder is required'), { statusCode: 400 });
  }
  if (!ACCOUNT_NUMBER_REGEX.test(accountNumber)) {
    throw Object.assign(new Error('Account number must contain 6-20 digits'), {
      statusCode: 400,
    });
  }

  try {
    const record = await paymentMethodModel.createBankAccount({
      userId,
      bankName,
      bankCode,
      accountHolder,
      accountNumber,
      isDefault,
    });
    return {
      id: record.id,
      bankName: record.bank_name,
      bankCode: record.bank_code,
      accountHolder: record.account_holder,
      accountNumberMasked: maskAccountNumber(record.account_number),
      isDefault: record.is_default,
      verifiedAt: record.verified_at,
      createdAt: record.created_at,
    };
  } catch (error) {
    if (error.code === '23505') {
      throw Object.assign(new Error('This bank account is already linked'), {
        statusCode: 409,
      });
    }
    throw error;
  }
}

module.exports = {
  listBankAccounts,
  createBankAccount,
};
