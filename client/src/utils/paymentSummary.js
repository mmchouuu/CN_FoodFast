import { formatPaymentStatusLabel } from './paymentDisplay';

const capitalise = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

const fallbackMethodLabel = (flow) =>
  flow === 'online' ? 'Online payment' : 'Cash on Delivery';

const normaliseFlow = (value) =>
  (typeof value === 'string' ? value.trim().toLowerCase() : '') || 'cash';

export const resolvePaymentSummary = (order = {}) => {
  const details = order.paymentDetails || order.payment_details || null;
  const flow = normaliseFlow(order.paymentFlow || details?.flow || order?.raw?.flow);

  const method =
    order.paymentMethodLabel ||
    details?.display_name ||
    order.paymentMethod ||
    fallbackMethodLabel(flow);

  const rawStatus =
    order.paymentStatus ||
    details?.status ||
    (flow === 'online' ? 'pending' : 'unpaid');

  const status =
    order.paymentStatusLabel ||
    formatPaymentStatusLabel(details, rawStatus) ||
    capitalise(rawStatus);

  const reference =
    order.paymentReference ||
    details?.payment_id ||
    details?.transaction_id ||
    order.metadata?.payment?.reference ||
    'N/A';

  return {
    flow,
    method,
    status,
    reference,
    details,
  };
};

export default resolvePaymentSummary;
