// payment-service/src/services/paymentMethod.service.js

const paymentMethodModel = require('../models/paymentMethod.model');

const PHONE_REGEX = /^[0-9]{8,13}$/;

const sanitizeString = (value) =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const formatPhoneForDisplay = (phoneNumber) => {
  const digits = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : '';
  if (!digits) return '';
  return `${digits.slice(0, 3)} **** ${digits.slice(-3)}`.trim();
};

async function listWallets(userId) {
  const rows = await paymentMethodModel.listMomoWallets(userId);
  return rows.map((row) => {
    const providerData =
      row.provider_data && typeof row.provider_data === 'object' ? row.provider_data : {};
    return {
      id: row.id,
      walletName:
        providerData.display_name || providerData.owner_name || providerData.wallet_name || 'MoMo Wallet',
      phoneNumber: providerData.phone_number || null,
      walletId: providerData.wallet_id || null,
      maskedPhone: providerData.phone_number ? formatPhoneForDisplay(providerData.phone_number) : null,
      isDefault: row.is_default,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
    };
  });
}

async function createWallet(userId, payload) {
  const walletName = sanitizeString(payload.walletName || payload.accountHolder || payload.ownerName);
  const phoneNumberRaw = sanitizeString(payload.phoneNumber || '');
  const walletId = sanitizeString(payload.walletId || payload.momoId || '');
  const isDefault = payload.isDefault === true;

  if (!walletName) {
    throw Object.assign(new Error('MoMo account name is required'), { statusCode: 400 });
  }
  const digitsOnly = phoneNumberRaw.replace(/\D/g, '');
  const normalizedPhone =
    digitsOnly.startsWith('84') && digitsOnly.length >= 11 ? `0${digitsOnly.slice(2)}` : digitsOnly;
  if (!normalizedPhone || !PHONE_REGEX.test(normalizedPhone)) {
    throw Object.assign(new Error('Please enter a valid MoMo phone number'), { statusCode: 400 });
  }

  const record = await paymentMethodModel.createMomoWallet({
    userId,
    displayName: walletName,
    phoneNumber: normalizedPhone,
    walletId: walletId || null,
    isDefault,
    providerData: {
      display_name: walletName,
      phone_number: normalizedPhone,
      wallet_id: walletId || null,
    },
  });

  return {
    id: record.id,
    walletName: walletName,
    phoneNumber: normalizedPhone,
    walletId: walletId || null,
    maskedPhone: formatPhoneForDisplay(normalizedPhone),
    isDefault: record.is_default,
    createdAt: record.created_at,
    verifiedAt: record.verified_at,
  };
}

module.exports = {
  listWallets,
  createWallet,
  listBankAccounts: listWallets,
  createBankAccount: createWallet,
};
