const toCamel = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
};

const extractContactName = (source = {}) => {
  if (!source || typeof source !== 'object') return null;
  const direct =
    source.contact_name ||
    source.contactName ||
    source.full_name ||
    source.fullName ||
    source.name;
  if (direct && typeof direct === 'string') {
    return direct.trim();
  }
  const parts = [
    source.first_name || source.firstName || '',
    source.last_name || source.lastName || '',
  ].filter(Boolean);
  if (parts.length) {
    return parts.join(' ').trim();
  }
  return null;
};

const extractContactPhone = (source = {}) => {
  if (!source || typeof source !== 'object') return null;
  return (
    source.contact_phone ||
    source.contactPhone ||
    source.phone ||
    source.phone_number ||
    source.phoneNumber ||
    null
  );
};

const deriveDeliveryRecord = (order, metadata = {}, shippingSnapshot = null) => {
  const deliveryMeta =
    metadata.delivery && typeof metadata.delivery === 'object' ? metadata.delivery : null;

  const deliveryAddress =
    (deliveryMeta &&
      (deliveryMeta.delivery_address ||
        deliveryMeta.address ||
        deliveryMeta.snapshot ||
        deliveryMeta.location)) ||
    metadata.delivery_address ||
    metadata.selected_address ||
    shippingSnapshot ||
    null;

  const status =
    (deliveryMeta && (deliveryMeta.delivery_status || deliveryMeta.status)) ||
    metadata.delivery_status ||
    metadata.deliveryStatus ||
    null;

  const estimatedAt =
    (deliveryMeta && (deliveryMeta.estimated_at || deliveryMeta.estimatedAt)) ||
    metadata.delivery_estimated_at ||
    metadata.deliveryEstimatedAt ||
    null;
  const deliveredAt =
    (deliveryMeta && (deliveryMeta.delivered_at || deliveryMeta.deliveredAt)) ||
    metadata.delivery_delivered_at ||
    metadata.deliveryDeliveredAt ||
    null;

  const proof =
    (deliveryMeta && deliveryMeta.proof) ||
    metadata.delivery_proof ||
    metadata.deliveryProof ||
    null;

  const contactSource =
    (deliveryMeta && (deliveryMeta.contact || deliveryMeta.contact_info)) ||
    deliveryMeta ||
    metadata.selected_address ||
    deliveryAddress ||
    null;

  const contactName =
    (deliveryMeta &&
      (deliveryMeta.contact_name ||
        deliveryMeta.contactName ||
        deliveryMeta[toCamel('contact_name')])) ||
    extractContactName(contactSource) ||
    metadata.customer_name ||
    metadata.customerName ||
    null;

  const contactPhone =
    (deliveryMeta &&
      (deliveryMeta.contact_phone ||
        deliveryMeta.contactPhone ||
        deliveryMeta[toCamel('contact_phone')])) ||
    extractContactPhone(contactSource) ||
    metadata.customer_phone ||
    metadata.customerPhone ||
    null;

  if (!deliveryAddress && !status && !estimatedAt && !deliveredAt && !proof && !contactName && !contactPhone) {
    return null;
  }

  return {
    id: (deliveryMeta && deliveryMeta.id) || null,
    order_id: (order && order.id) || (deliveryMeta && deliveryMeta.order_id) || null,
    delivery_status: status || 'pending',
    delivery_address: deliveryAddress,
    contact_name: contactName,
    contact_phone: contactPhone,
    estimated_at: estimatedAt,
    delivered_at: deliveredAt,
    proof: proof || null,
    created_at: (deliveryMeta && deliveryMeta.created_at) || null,
    updated_at: (deliveryMeta && deliveryMeta.updated_at) || null,
  };
};

module.exports = {
  deriveDeliveryRecord,
};
