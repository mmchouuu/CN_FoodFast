CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- 1) ORDERS: nguồn sự thật về tiền cần thu
-- =========================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                  -- soft ref: user-service.users.id
  restaurant_id UUID NOT NULL,            -- soft ref: product-service.restaurants.id
  branch_id UUID,                         -- soft ref: product-service.restaurant_branches.id

  source VARCHAR(30) DEFAULT 'app'
    CHECK (source IN ('app','web','pos','other')),
  fulfillment_type VARCHAR(20) NOT NULL DEFAULT 'delivery'
    CHECK (fulfillment_type IN ('delivery','pickup','dinein')),

  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','preparing','ready','delivering','completed','cancelled')),
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','authorized','paid','refunded','partially_refunded','failed')),

  -- Tổng hợp tiền (snapshot bất biến)
  items_subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0,  -- tổng dòng, trước KM đơn-level
  items_discount    NUMERIC(12,2) NOT NULL DEFAULT 0,  -- tổng giảm theo dòng
  order_discount    NUMERIC(12,2) NOT NULL DEFAULT 0,  -- giảm đơn-level
  surcharges_total  NUMERIC(12,2) NOT NULL DEFAULT 0,  -- phụ phí (gói/peak/đơn nhỏ…)
  shipping_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(12,2) NOT NULL DEFAULT 0,  -- tổng thuế (sau phân bổ KM)
  tip_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- số tiền phải thu cuối
  currency          VARCHAR(10) NOT NULL DEFAULT 'VND',

  promo_code        VARCHAR(50),
  note              TEXT,

  -- Địa chỉ: soft ref + snapshot text để không "trôi"
  shipping_address_id UUID,            -- soft ref: user-service.user_addresses.id
  shipping_address_snapshot JSONB,     -- {"full_name","phone","street",...}
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user         ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant   ON orders(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_branch       ON orders(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_stat ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at);

-- =========================================================
-- 2) ORDER ITEMS: hỗ trợ product + combo (cha/con) + priced flag
-- =========================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  parent_item_id UUID,                           -- self-ref (combo cha)
  item_kind VARCHAR(20) NOT NULL DEFAULT 'product'
    CHECK (item_kind IN ('product','combo','combo_item')),
  is_priced BOOLEAN NOT NULL DEFAULT TRUE,       -- dòng có cộng tiền?

  product_id UUID,                                -- soft ref: product-service.products.id
  branch_product_id UUID,                         -- soft ref: product-service.branch_products.id
  title VARCHAR(200) NOT NULL,                    -- snapshot tên
  image TEXT,
  category_id UUID,                               -- soft ref

  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,    -- base sau rule/override
  quantity INT NOT NULL CHECK (quantity > 0),

  addons_total  NUMERIC(12,2) NOT NULL DEFAULT 0, -- tổng add-on/topping dòng
  line_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, -- unit*qty + addons_total
  line_discount NUMERIC(12,2) NOT NULL DEFAULT 0, -- giảm theo dòng
  line_tax      NUMERIC(12,2) NOT NULL DEFAULT 0, -- thuế sau phân bổ KM đơn-level
  line_total    NUMERIC(12,2) NOT NULL DEFAULT 0, -- sau thuế & giảm

  product_snapshot JSONB                           -- JSON full thuộc tính/giá/thuế hiệu lực
);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_parent ON order_items(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_kind   ON order_items(item_kind);
CREATE INDEX IF NOT EXISTS idx_order_items_priced ON order_items(is_priced);

-- =========================================================
-- 3) ORDER ITEM OPTIONS: snapshot add-ons
-- =========================================================
CREATE TABLE IF NOT EXISTS order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_group_name VARCHAR(150) NOT NULL,
  option_item_name  VARCHAR(150) NOT NULL,
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_oio_item ON order_item_options(order_item_id);

-- =========================================================
-- 4) THUẾ: breakdown theo dòng & theo đơn
-- =========================================================
CREATE TABLE IF NOT EXISTS order_item_tax_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  tax_template_code VARCHAR(50),                 -- 'VAT7_DEFAULT'|'HOLIDAY10'...
  tax_rate NUMERIC(5,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oitb_item ON order_item_tax_breakdowns(order_item_id);

CREATE TABLE IF NOT EXISTS order_tax_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tax_template_code VARCHAR(50),
  tax_rate NUMERIC(5,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otb_order ON order_tax_breakdowns(order_id);

-- =========================================================
-- 5) DISCOUNTS / SURCHARGES / PROMOTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS order_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source VARCHAR(30) NOT NULL CHECK (source IN ('promo','manual','auto')),
  code VARCHAR(50),
  amount NUMERIC(12,2) NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ods_order ON order_discounts(order_id);

CREATE TABLE IF NOT EXISTS order_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('packaging','peak','small_order','other')),
  amount NUMERIC(12,2) NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_osg_order ON order_surcharges(order_id);

CREATE TABLE IF NOT EXISTS order_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  promotion_id UUID,          -- soft ref: product-service.promotions.id
  code VARCHAR(50),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oprom_order ON order_promotions(order_id);

-- =========================================================
-- 6) DELIVERIES (tối giản)
-- =========================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'preparing'
    CHECK (delivery_status IN ('preparing','dispatched','arriving','delivered','failed','cancelled')),
  delivery_address TEXT,
  contact_name VARCHAR(150),
  contact_phone VARCHAR(30),
  estimated_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  provider VARCHAR(100),
  proof JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_order  ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(delivery_status);

-- =========================================================
-- 7) EVENTS / REVISIONS / IDEMPOTENCY
-- =========================================================
CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  actor_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

CREATE TABLE IF NOT EXISTS order_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rev_no INT NOT NULL,
  snapshot JSONB NOT NULL,         -- full order + items
  reason VARCHAR(200),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id, rev_no)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  scope VARCHAR(50) NOT NULL,      -- 'create_order'|'update_status'...
  order_id UUID,
  response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_idem_scope ON idempotency_keys(scope, order_id);

-- =========================================================
-- 8) OUTBOX (event-driven)
-- =========================================================
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL,  -- 'Order','Delivery',...
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_agg       ON outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox(processed);
