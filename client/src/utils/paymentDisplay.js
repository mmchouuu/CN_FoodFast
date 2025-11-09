const normalise = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const FALLBACK_METHOD_LABELS = {
  cod: 'Cash on Delivery',
  cash: 'Cash on Delivery',
  cash_on_delivery: 'Cash on Delivery',
  online: 'Online payment',
  card: 'Card payment',
  wallet: 'Wallet payment',
  momo: 'MoMo Wallet',
  zalopay: 'ZaloPay',
  bank: 'Bank transfer',
  bank_transfer: 'Bank transfer',
};

const resolveFallbackLabel = (value) => {
  const key = normalise(value) || 'cod';
  return FALLBACK_METHOD_LABELS[key] || (value ? value.toUpperCase() : 'COD');
};

export const formatPaymentMethodLabel = (details, fallback = 'COD') => {
  if (!details) {
    return resolveFallbackLabel(fallback);
  }

  if (details.display_name) {
    return details.display_name;
  }

  const flow = normalise(details.flow || details.payment_flow);
  if (flow === 'cash') {
    return 'Cash on Delivery';
  }

  const type = details.method_details?.type || details.method_type;
  const provider =
    details.method_details?.provider ||
    details.provider ||
    details.method_provider ||
    '';
  const brand = details.method_details?.brand || details.method_brand || null;
  const last4 = details.method_details?.last4 || details.method_last4 || null;

  if (type === 'card') {
    const labelBrand = brand || (provider ? provider.toUpperCase() : 'Card');
    return last4 ? `${labelBrand} •••• ${last4}` : labelBrand;
  }

  if (type === 'wallet') {
    const walletLabel = provider ? provider.toUpperCase() : 'Wallet';
    return last4 ? `${walletLabel} •••• ${last4}` : walletLabel;
  }

  if (flow === 'online') {
    return provider ? `${provider.toUpperCase()} payment` : 'Online payment';
  }

  return resolveFallbackLabel(fallback || (flow === 'cash' ? 'cod' : 'online'));
};

export const formatPaymentStatusLabel = (details, fallback = 'pending') => {
  const status = details?.status || fallback || 'pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
};
