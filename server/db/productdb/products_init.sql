CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1) RESTAURANTS (soft reference chủ sở hữu)
-- =====================================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  about TEXT,
  cuisine VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(150),
  logo  TEXT[],
  images TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  avg_branch_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_branch_ratings INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner   ON restaurants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_name    ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine);

-- =====================================================================
-- 2) BRANCHES
-- =====================================================================
CREATE TABLE IF NOT EXISTS restaurant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  branch_number INT NOT NULL,
  name VARCHAR(150),
  branch_phone VARCHAR(50),
  branch_email VARCHAR(150),
  rating NUMERIC(3,2) DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  images TEXT[],
  street VARCHAR(200) NOT NULL,
  ward VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  latitude  NUMERIC(9,6),
  longitude NUMERIC(9,6),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_open    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_branch_per_restaurant UNIQUE (restaurant_id, branch_number)
);
CREATE INDEX IF NOT EXISTS idx_branches_restaurant ON restaurant_branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_branches_city       ON restaurant_branches(city, district);
CREATE INDEX IF NOT EXISTS idx_branches_primary    ON restaurant_branches(restaurant_id, is_primary);

-- =====================================================================
-- 3) OPENING HOURS
-- =====================================================================
CREATE TABLE IF NOT EXISTS branch_opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time  TIME,
  close_time TIME,
  is_closed  BOOLEAN NOT NULL DEFAULT FALSE,
  overnight  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_hours UNIQUE (branch_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_hours_branch ON branch_opening_hours(branch_id, day_of_week);

CREATE TABLE IF NOT EXISTS branch_special_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  on_date DATE NOT NULL,
  open_time  TIME,
  close_time TIME,
  is_closed  BOOLEAN NOT NULL DEFAULT FALSE,
  overnight  BOOLEAN NOT NULL DEFAULT FALSE,
  note VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_special UNIQUE (branch_id, on_date)
);
CREATE INDEX IF NOT EXISTS idx_special_hours ON branch_special_hours(branch_id, on_date);

-- =====================================================================
-- 4) CATEGORIES (chỉ cấp restaurant)
-- =====================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant
  ON categories(restaurant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_categories_name
  ON categories(name);

-- =====================================================================
-- 4.1) BRANCH_CATEGORY_ASSIGNMENTS (N–N)
-- =====================================================================
CREATE TABLE IF NOT EXISTS branch_category_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  category_id UUID NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_cat_assign
  ON branch_category_assignments(branch_id, is_active, is_visible);


-- =====================================================================
-- 5) TAX: MASTER + CALENDAR + ASSIGNMENTS (N-N)
-- =====================================================================

-- 5.1) Master loại thuế (dùng chung toàn hệ thống)
CREATE TABLE IF NOT EXISTS tax_templates (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,          -- ví dụ: 'VAT7_DEFAULT', 'HOLIDAY10'
  name VARCHAR(150) NOT NULL,
  description TEXT
);

-- 5.2) Calendars & Dates (để bật thuế theo ngày lễ/sự kiện)
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  scope_type VARCHAR(20) NOT NULL DEFAULT 'global'
    CHECK (scope_type IN ('global','restaurant','branch')),
  restaurant_id UUID,
  branch_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_calendar_scope CHECK (
    (scope_type='global'     AND restaurant_id IS NULL AND branch_id IS NULL) OR
    (scope_type='restaurant' AND restaurant_id IS NOT NULL AND branch_id IS NULL) OR
    (scope_type='branch'     AND branch_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cal_scope ON calendars(scope_type, restaurant_id, branch_id, is_active);

CREATE TABLE IF NOT EXISTS calendar_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL,
  on_date DATE NOT NULL,
  start_date DATE,
  end_date   DATE,
  label VARCHAR(150),
  is_holiday BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (calendar_id, on_date)
);
CREATE INDEX IF NOT EXISTS idx_cal_dates ON calendar_dates(calendar_id, on_date);

-- 5.3) Gán thuế cho RESTAURANT (N-N)
CREATE TABLE IF NOT EXISTS restaurant_tax_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL,
  tax_template_id UUID NOT NULL,
  rate_percent NUMERIC(5,2),                    -- nếu NULL, engine tự suy theo template/policy
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,   -- bản ghi mặc định của brand (vd 7%)
  calendar_id UUID,                             -- dùng khi là thuế ngày lễ theo calendar
  start_at TIMESTAMPTZ,                         -- hoặc theo khoảng thời gian
  end_at   TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 100,            -- số nhỏ = ưu tiên cao
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_rta_window CHECK (
    (start_at IS NULL AND end_at IS NULL) OR (start_at IS NOT NULL AND end_at IS NOT NULL AND start_at < end_at)
  ),
  UNIQUE (restaurant_id, tax_template_id)
);
CREATE INDEX IF NOT EXISTS idx_rta_restaurant ON restaurant_tax_assignments(restaurant_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_rta_calendar   ON restaurant_tax_assignments(calendar_id);
CREATE INDEX IF NOT EXISTS idx_rta_time       ON restaurant_tax_assignments(start_at, end_at);

-- Mỗi restaurant có đúng 1 bản ghi mặc định đang active
CREATE UNIQUE INDEX IF NOT EXISTS uq_rta_default_per_restaurant
  ON restaurant_tax_assignments(restaurant_id)
  WHERE is_default = TRUE AND is_active = TRUE;

-- 5.4) Gán thuế cho BRANCH (N-N) — tùy chọn nếu chi nhánh có thuế riêng
CREATE TABLE IF NOT EXISTS branch_tax_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL,
  tax_template_id UUID NOT NULL,
  rate_percent NUMERIC(5,2),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  calendar_id UUID,
  start_at TIMESTAMPTZ,
  end_at   TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bta_window CHECK (
    (start_at IS NULL AND end_at IS NULL) OR (start_at IS NOT NULL AND end_at IS NOT NULL AND start_at < end_at)
  ),
  UNIQUE (branch_id, tax_template_id)
);
CREATE INDEX IF NOT EXISTS idx_bta_branch  ON branch_tax_assignments(branch_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_bta_calendar ON branch_tax_assignments(calendar_id);
CREATE INDEX IF NOT EXISTS idx_bta_time     ON branch_tax_assignments(start_at, end_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bta_default_per_branch
  ON branch_tax_assignments(branch_id)
  WHERE is_default = TRUE AND is_active = TRUE;

-- 5.5) (OPTIONAL) Override thuế ở cấp PRODUCT / BRANCH_PRODUCT
--      Nếu muốn một số món bị ép dùng template thuế khác với mặc định.
CREATE TABLE IF NOT EXISTS product_tax_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  tax_template_id UUID NOT NULL,
  rate_percent NUMERIC(5,2),        -- nếu NULL, lấy rate từ assignment phù hợp
  start_at TIMESTAMPTZ,
  end_at   TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 50,  -- ưu tiên cao hơn assignment chung
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_pto_window CHECK (
    (start_at IS NULL AND end_at IS NULL) OR (start_at IS NOT NULL AND end_at IS NOT NULL AND start_at < end_at)
  )
);
CREATE INDEX IF NOT EXISTS idx_pto_prod ON product_tax_overrides(product_id, is_active, priority);

CREATE TABLE IF NOT EXISTS branch_product_tax_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  product_id UUID NOT NULL,
  tax_template_id UUID NOT NULL,
  rate_percent NUMERIC(5,2),
  start_at TIMESTAMPTZ,
  end_at   TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 40,  -- cao hơn product-level
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_bpto_window CHECK (
    (start_at IS NULL AND end_at IS NULL) OR (start_at IS NOT NULL AND end_at IS NOT NULL AND start_at < end_at)
  ),
  UNIQUE (branch_id, product_id, tax_template_id)
);
CREATE INDEX IF NOT EXISTS idx_bpto_branch_prod ON branch_product_tax_overrides(branch_id, product_id, is_active, priority);

-- =====================================================================
-- 6) PRODUCTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  images TEXT[],
  type VARCHAR(50),
  category_id UUID,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  popular  BOOLEAN DEFAULT FALSE,
  available BOOLEAN DEFAULT TRUE,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_visible    ON products(is_visible);

-- =====================================================================
-- 7) BRANCH MENU (override giá/thuế theo chi nhánh)
-- =====================================================================
CREATE TABLE IF NOT EXISTS branch_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL,
  product_id UUID NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT CHECK (display_order IS NULL OR display_order >= 0),
  price_mode VARCHAR(16) NOT NULL DEFAULT 'inherit' -- 'inherit' | 'override'
    CHECK (price_mode IN ('inherit','override')),
  base_price_override NUMERIC(12,2),
  local_name VARCHAR(200),
  local_description TEXT,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  dayparts TEXT[],
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_branch_product UNIQUE (branch_id, product_id),
  CONSTRAINT ck_override_price_required CHECK (
    (price_mode='inherit'  AND base_price_override IS NULL) OR
    (price_mode='override' AND base_price_override IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_bp_branch  ON branch_products(branch_id);
CREATE INDEX IF NOT EXISTS idx_bp_product ON branch_products(product_id);
CREATE INDEX IF NOT EXISTS idx_bp_visible ON branch_products(is_visible, is_available);

-- =====================================================================
-- 8) PRICE RULES (theo thời gian)
-- =====================================================================
CREATE TABLE IF NOT EXISTS branch_product_price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_product_id UUID NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at   TIMESTAMPTZ NOT NULL,
  days_of_week SMALLINT[],
  requires_special BOOLEAN NOT NULL DEFAULT FALSE,
  rule_type VARCHAR(20) NOT NULL  -- 'fixed_price'|'percent_markup'|'percent_discount'|'flat_delta'
    CHECK (rule_type IN ('fixed_price','percent_markup','percent_discount','flat_delta')),
  rule_value NUMERIC(12,2) NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpr_time ON branch_product_price_rules(branch_product_id, start_at, end_at, is_active, priority);

-- =====================================================================
-- 9) OPTIONS / ADD-ONS (nhóm & item)
-- =====================================================================
CREATE TABLE IF NOT EXISTS option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  selection_type VARCHAR(12) NOT NULL DEFAULT 'multiple'  -- 'single'|'multiple'
    CHECK (selection_type IN ('single','multiple')),
  min_select SMALLINT NOT NULL DEFAULT 0,
  max_select SMALLINT,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opt_groups_rest ON option_groups(restaurant_id, is_active);

CREATE TABLE IF NOT EXISTS option_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, name)
);
CREATE INDEX IF NOT EXISTS idx_opt_items_group ON option_items(group_id, is_active);

CREATE TABLE IF NOT EXISTS product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  group_id UUID NOT NULL,
  min_select SMALLINT,
  max_select SMALLINT,
  is_required BOOLEAN,
  display_order INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_pog_product ON product_option_groups(product_id, is_active);

-- CREATE TABLE IF NOT EXISTS branch_product_option_items (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   branch_id UUID NOT NULL,
--   product_id UUID NOT NULL,
--   option_item_id UUID NOT NULL,
--   is_available BOOLEAN NOT NULL DEFAULT TRUE,
--   price_delta_override NUMERIC(12,2),
--   is_visible BOOLEAN NOT NULL DEFAULT TRUE,
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now(),
--   UNIQUE (branch_id, product_id, option_item_id)
-- );
-- CREATE INDEX IF NOT EXISTS idx_bpoi_branch_product ON branch_product_option_items(branch_id, product_id, is_available, is_visible);

CREATE TABLE IF NOT EXISTS branch_product_option_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_product_id UUID NOT NULL REFERENCES branch_products(id) ON DELETE CASCADE,
  option_item_id UUID NOT NULL REFERENCES option_items(id) ON DELETE CASCADE,
  price_delta NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_product_id, option_item_id)
);

CREATE TABLE IF NOT EXISTS branch_product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_product_id UUID NOT NULL REFERENCES branch_products(id) ON DELETE CASCADE,
  option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  min_select SMALLINT,
  max_select SMALLINT,
  is_required BOOLEAN,
  display_order INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_product_id, option_group_id)
);

-- Optional: bật/tắt nhóm option tại chi nhánh
CREATE TABLE IF NOT EXISTS branch_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE (branch_id, option_group_id)
);

-- Optional: ghi log đồng bộ tự động
CREATE TABLE IF NOT EXISTS branch_option_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_product_id UUID NOT NULL,
  sync_action VARCHAR(30) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  details JSONB
);


-- =====================================================================
-- 10) COMBOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  base_price NUMERIC(12,2) NOT NULL,
  images TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_combos_rest ON combos(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_combos_time ON combos(available_from, available_until);

CREATE TABLE IF NOT EXISTS combo_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  min_select SMALLINT NOT NULL DEFAULT 1,
  max_select SMALLINT NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_combo_groups ON combo_groups(combo_id);

CREATE TABLE IF NOT EXISTS combo_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_group_id UUID NOT NULL,
  item_type VARCHAR(20) NOT NULL  -- 'product'|'category'
    CHECK (item_type IN ('product','category')),
  product_id UUID,
  category_id UUID,
  extra_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_cgi_item CHECK (
    (item_type='product'  AND product_id IS NOT NULL AND category_id IS NULL) OR
    (item_type='category' AND category_id IS NOT NULL AND product_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cgi_group ON combo_group_items(combo_group_id, item_type);

CREATE TABLE IF NOT EXISTS branch_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  combo_id UUID NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  base_price_override NUMERIC(12,2),
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_id, combo_id)
);
CREATE INDEX IF NOT EXISTS idx_bcombo_branch ON branch_combos(branch_id, is_available, is_visible);

-- =====================================================================
-- 11) INVENTORY
-- =====================================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_product_id UUID NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reserved_qty INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 10,
  daily_limit INT,
  daily_sold INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  last_restock_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_inventory_branch_product UNIQUE (branch_product_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_bp ON inventory(branch_product_id);

-- =====================================================================
-- 12) RATINGS
-- =====================================================================
CREATE TABLE IF NOT EXISTS branch_rating (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL,
  rating_value INT CHECK (rating_value BETWEEN 1 AND 5),
  comment TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_branch_rating UNIQUE (branch_id, user_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_rating_branch ON branch_rating(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_rating_user   ON branch_rating(user_id);

CREATE TABLE IF NOT EXISTS branch_rating_avg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL UNIQUE,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_ratings INT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- 13) PROMOTIONS (order/item-level) — (giữ nguyên cấu trúc bạn đã dùng nếu cần)
-- =====================================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type VARCHAR(20) NOT NULL  -- 'global'|'restaurant'|'branch'
    CHECK (scope_type IN ('global','restaurant','branch')),
  restaurant_id UUID,
  branch_id UUID,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  promo_type VARCHAR(20) NOT NULL  -- 'order'|'item'
    CHECK (promo_type IN ('order','item')),
  discount_type VARCHAR(20) NOT NULL  -- 'percent'|'amount'
    CHECK (discount_type IN ('percent','amount')),
  discount_value NUMERIC(12,2) NOT NULL,
  max_discount NUMERIC(12,2),
  coupon_code VARCHAR(50),
  stackable BOOLEAN NOT NULL DEFAULT FALSE,
  usage_limit INT,
  per_user_limit INT,
  min_order_amount NUMERIC(12,2),
  start_at TIMESTAMPTZ,
  end_at   TIMESTAMPTZ,
  days_of_week SMALLINT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_prom_scope CHECK (
    (scope_type='global'     AND restaurant_id IS NULL AND branch_id IS NULL) OR
    (scope_type='restaurant' AND restaurant_id IS NOT NULL AND branch_id IS NULL) OR
    (scope_type='branch'     AND branch_id IS NOT NULL)
  ),
  CONSTRAINT chk_prom_discount CHECK (
    (discount_type='percent' AND discount_value BETWEEN 0 AND 100) OR
    (discount_type='amount'  AND discount_value >= 0)
  )
);
CREATE INDEX IF NOT EXISTS idx_promotions_scope ON promotions(scope_type, restaurant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_promotions_time  ON promotions(start_at, end_at, is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_code  ON promotions(coupon_code);

CREATE TABLE IF NOT EXISTS promotion_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL   -- 'product'|'category'|'restaurant'|'branch'
    CHECK (target_type IN ('product','category','restaurant','branch')),
  product_id UUID,
  category_id UUID,
  restaurant_id UUID,
  branch_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_pt_target CHECK (
    (target_type='product'    AND product_id IS NOT NULL AND category_id IS NULL AND restaurant_id IS NULL AND branch_id IS NULL) OR
    (target_type='category'   AND category_id IS NOT NULL AND product_id IS NULL AND restaurant_id IS NULL AND branch_id IS NULL) OR
    (target_type='restaurant' AND restaurant_id IS NOT NULL AND product_id IS NULL AND category_id IS NULL AND branch_id IS NULL) OR
    (target_type='branch'     AND branch_id IS NOT NULL AND product_id IS NULL AND category_id IS NULL AND restaurant_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_promo_targets_prom ON promotion_targets(promotion_id, target_type);

CREATE TABLE IF NOT EXISTS promotion_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL,
  exclude_type VARCHAR(20) NOT NULL  -- 'product'|'category'
    CHECK (exclude_type IN ('product','category')),
  product_id UUID,
  category_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_pe_target CHECK (
    (exclude_type='product'  AND product_id IS NOT NULL AND category_id IS NULL) OR
    (exclude_type='category' AND category_id IS NOT NULL AND product_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_promo_excl_prom ON promotion_exclusions(promotion_id, exclude_type);

CREATE TABLE IF NOT EXISTS promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL,
  user_id UUID,
  order_id UUID,
  branch_id UUID,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discount_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_prom_user ON promotion_redemptions(promotion_id, user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_prom_time ON promotion_redemptions(promotion_id, used_at);

-- =====================================================================
-- 14) OUTBOX
-- =====================================================================
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL,  -- 'Restaurant','Branch','Product','Tax','Promotion',...
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_agg       ON outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox(processed);


-- =====================================================================
-- SAMPLE RESTAURANT DATASET FOR LOCAL DEVELOPMENT
-- =====================================================================

INSERT INTO restaurants (
  id,
  owner_user_id,
  name,
  description,
  about,
  cuisine,
  phone,
  email,
  logo,
  images
)
VALUES
  ('21111111-1111-4111-8111-000000000101', '11111111-1111-4111-8111-000000000101', 'Lotte Mart Food Hall', 'Korean fusion food court featuring signature dishes from Lotte Mart.', 'Curated stalls serving trending Korean comfort food, desserts and beverages throughout the day.', 'Korean Fusion', '02836223344', 'contact@lottefoodhall.vn', ARRAY['https://upload.wikimedia.org/wikipedia/commons/4/4d/Lotte_logo.svg'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/1/15/Lotte_Mart_Vietnam.jpg','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000102', '11111111-1111-4111-8111-000000000102', 'KFC Vietnam', 'Kentucky Fried Chicken quick service restaurants across Vietnam.', 'Serving Original Recipe chicken, burgers and sides prepared fresh in store.', 'American Fast Food', '19006886', 'support@kfcvietnam.vn', ARRAY['https://upload.wikimedia.org/wikipedia/commons/b/bf/KFC_logo.svg'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/7/7d/KFC_Restaurant.jpg','https://images.unsplash.com/photo-1606755962773-0e7d1c9a5ddc?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000103', '11111111-1111-4111-8111-000000000103', 'Jollibee Vietnam', 'Philippines born quick service restaurant famous for fried chicken and sweet-style spaghetti.', 'Bright, family-friendly dining rooms with rice meals, burgers and desserts loved across Vietnam.', 'Filipino Fast Food', '19001533', 'hello@jollibee.vn', ARRAY['https://upload.wikimedia.org/wikipedia/en/5/5a/Jollibee_logo.svg'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/1/1e/Jollibee_store.jpg','https://images.unsplash.com/photo-1586816879360-954c3d0262a4?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000104', '11111111-1111-4111-8111-000000000104', 'Busan Bistro', 'Modern Korean dining inspired by the coastal flavors of Busan.', 'Seasonal menu crafted with handmade broths, cold noodles and street food favourites.', 'Korean Casual Dining', '02822997788', 'hello@busanbistro.vn', ARRAY['https://upload.wikimedia.org/wikipedia/commons/5/5f/Korean_food_logo.png'], ARRAY['https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=900&q=80','https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000105', '11111111-1111-4111-8111-000000000105', 'Sasin Hotpot', 'Thai and Vietnamese style hotpot chain known for rich broths and affordable combos.', 'Comfortable social dining with refillable toppings, handmade sauces and seasonal seafood.', 'Hotpot & Thai Street Food', '02822112211', 'cskh@sasinhotpot.vn', ARRAY['https://sasin.vn/wp-content/uploads/2020/05/logo-sasin.png'], ARRAY['https://sasin.vn/wp-content/uploads/2020/05/lau-sasin.jpg','https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000106', '11111111-1111-4111-8111-000000000106', 'Highlands Coffee', 'Vietnamese coffeehouse brand serving robusta-based drinks and bakery treats.', 'Spaces designed for casual meetings with signature phin coffee, teas and light meals.', 'Coffeehouse', '02862744444', 'contact@highlandscoffee.vn', ARRAY['https://upload.wikimedia.org/wikipedia/commons/4/4f/Highlands_Coffee_logo.svg'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/d/dc/Highlands_Coffee_in_HCMC.jpg','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000107', '11111111-1111-4111-8111-000000000107', 'Katinat Saigon Kafe', 'Local lifestyle cafe spotlighting specialty drinks and handcrafted pastries.', 'Boutique Saigon-inspired interiors pairing cold brew, milk tea and modern brunch plates.', 'Cafe & Bakery', '02866886688', 'hello@katinat.vn', ARRAY['https://katinat.vn/wp-content/uploads/2023/05/katinat-logo.png'], ARRAY['https://katinat.vn/wp-content/uploads/2023/05/katinat-store.jpg','https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000108', '11111111-1111-4111-8111-000000000108', 'Bonchon Chicken', 'Korean fried chicken chain famous for double-fried crunchy wings.', 'Serving soy garlic and spicy chicken, bibimbap and street snacks in a contemporary setting.', 'Korean Fried Chicken', '02839393939', 'support@bonchon.vn', ARRAY['https://upload.wikimedia.org/wikipedia/commons/7/72/Bonchon_Logo.svg'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/9/9f/Bonchon_Chicken.jpg','https://images.unsplash.com/photo-1604908177086-d91f20d23e2d?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000109', '11111111-1111-4111-8111-000000000109', 'Texas Chicken', 'American fried chicken franchise serving hand-battered chicken and honey butter biscuits.', 'Bold flavors, hearty sides and quick service dining for families on the go.', 'American Fast Food', '02838486666', 'care@texaschicken.vn', ARRAY['https://upload.wikimedia.org/wikipedia/en/4/4a/Texas_Chicken_logo.svg'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/8/8e/Texas_Chicken_store.jpg','https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=80']),
  ('21111111-1111-4111-8111-000000000110', '11111111-1111-4111-8111-000000000110', 'Pizza 4P''s', 'Artisanal pizza restaurant famous for house-made cheese and farm to table ingredients.', 'Japanese founders crafting Neapolitan-style pizzas, pasta and sharing plates.', 'Artisan Pizza', '02836229988', 'hello@pizza4ps.com', ARRAY['https://upload.wikimedia.org/wikipedia/en/8/8e/Pizza_4P%27s_logo.png'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/e/e8/Pizza_4Ps.jpg','https://images.unsplash.com/photo-1548365328-5b6a2a1d5b37?auto=format&fit=crop&w=900&q=80'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO restaurant_branches (
  id,
  restaurant_id,
  branch_number,
  name,
  branch_phone,
  branch_email,
  rating,
  images,
  street,
  ward,
  district,
  city,
  latitude,
  longitude,
  is_primary,
  is_open
)
VALUES
  ('31111111-1111-4111-8111-000000000201', '21111111-1111-4111-8111-000000000101', 1, 'Lotte Mart District 1', '02836223344', 'd1@lottefoodhall.vn', 4.5, ARRAY['https://cmstest.lottemallwestlakehanoi.vn/storage/main-page/images/2b57fc1614ec5c8669c075c8a4255ff444cf6b24.jpg'], '469 Le Loi', 'Ben Thanh', 'District 1', 'Ho Chi Minh City', 10.775658, 106.700423, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000202', '21111111-1111-4111-8111-000000000101', 2, 'Lotte Mart District 7', '02837710011', 'd7@lottefoodhall.vn', 4.4, ARRAY['https://static1.cafeland.vn/cafelandData/upload/tintuc/thitruong/2023/09/tuan-03/moi-khai-truong-tap-doan-lotte-da-muon-gia-han-thoi-han-hoat-dong-trung-tam-thuong-mai-lon-nhat-nuoc-hua-se-mo-rong-dau-tu-tai-viet-nam-1695466869.jpg'], '485 Nguyen Thi Thap', 'Tan Phong', 'District 7', 'Ho Chi Minh City', 10.732620, 106.721450, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000203', '21111111-1111-4111-8111-000000000101', 3, 'Lotte Mart Thu Duc', '02838966000', 'thuduc@lottefoodhall.vn', 4.3, ARRAY['https://datvinhtien.vn/Data/Sites/1/Product/63/1.jpg'], '21 Vo Van Ngan', 'Linh Chieu', 'Thu Duc City', 'Ho Chi Minh City', 10.851460, 106.758800, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000204', '21111111-1111-4111-8111-000000000102', 1, 'KFC Nguyen Trai', '19006886', 'nguyentrai@kfcvietnam.vn', 4.6, ARRAY['https://tuyendung.kfcvietnam.com.vn/Data/Sites/1/News/78/gioithieu-hinhanh3.jpg'], '192 Nguyen Trai', 'Nguyen Cu Trinh', 'District 1', 'Ho Chi Minh City', 10.764340, 106.692391, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000205', '21111111-1111-4111-8111-000000000102', 2, 'KFC Nguyen Dinh Chieu', '19006886', 'nguyendinhchieu@kfcvietnam.vn', 4.4, ARRAY['https://cskh.org.vn/wp-content/uploads/2023/11/chi-nhanh-cua-hang-ga-ran-tren-Toan-quoc-.webp'], '189 Nguyen Dinh Chieu', 'Ward 5', 'District 3', 'Ho Chi Minh City', 10.784520, 106.688210, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000206', '21111111-1111-4111-8111-000000000103', 1, 'Jollibee Nguyen Kiem', '19001533', 'nguyenkim@jollibee.vn', 4.5, ARRAY['https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/21/editors/LK1Hc1miPlmFWCT7lLxoOlvkH7pbKAjhKq6Fg200.jpg'], '674 Nguyen Kiem', 'Ward 4', 'Go Vap District', 'Ho Chi Minh City', 10.822520, 106.671230, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000207', '21111111-1111-4111-8111-000000000103', 2, 'Jollibee Crescent Mall', '19001533', 'crescent@jollibee.vn', 4.4, ARRAY['https://aeonmall-hadong.com.vn/wp-content/uploads/2019/08/dsc01758-750x468.jpg'], '101 Ton Dat Tien', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 10.728340, 106.718430, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000208', '21111111-1111-4111-8111-000000000104', 1, 'Busan Bistro Nguyen Hue', '02822997788', 'nguyenhue@busanbistro.vn', 4.7, ARRAY['https://emdoi.vn/wp-content/uploads/2024/09/nha-hang-Busan-Korean-Food-1.webp'], '12 Nguyen Hue', 'Ben Nghe', 'District 1', 'Ho Chi Minh City', 10.773100, 106.705800, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000209', '21111111-1111-4111-8111-000000000104', 2, 'Busan Bistro Thao Dien', '02822997789', 'thaodien@busanbistro.vn', 4.6, ARRAY['https://product.hstatic.net/1000275435/product/414986336_382463904297535_5138232533235760266_n_7e855c3a9cdc47ec975a2b08b19cae50_master.jpg'], '49 Quoc Huong', 'Thao Dien', 'Thu Duc City', 'Ho Chi Minh City', 10.801420, 106.730650, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000210', '21111111-1111-4111-8111-000000000104', 3, 'Busan Bistro Phu My Hung', '02822997790', 'phumyhung@busanbistro.vn', 4.5, ARRAY['https://emdoi.vn/wp-content/uploads/2024/10/Busan-Korean-Food-nguyen-dinh-chieu-1.webp'], '15 Nguyen Khac Vien', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 10.726800, 106.718900, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000211', '21111111-1111-4111-8111-000000000105', 1, 'Sasin Hotpot Nguyen Trai', '02822112211', 'nguyentrai@sasinhotpot.vn', 4.4, ARRAY['https://sasin.vn:8005//Resource/Shared/0df4c98f-4c62-4e82-916a-f1be25b4abe1.jpg'], '120 Nguyen Trai', 'Ben Thanh', 'District 1', 'Ho Chi Minh City', 10.769880, 106.694210, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000212', '21111111-1111-4111-8111-000000000105', 2, 'Sasin Hotpot Go Vap', '02822112212', 'govap@sasinhotpot.vn', 4.3, ARRAY['https://sasin.vn:8005//Resource/Shared/a2937325-c063-4911-ba2d-948006c9a4e0.jpg'], '135 Quang Trung', 'Ward 10', 'Go Vap District', 'Ho Chi Minh City', 10.832140, 106.672410, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000213', '21111111-1111-4111-8111-000000000106', 1, 'Highlands Coffee Landmark 81', '02862744444', 'landmark81@highlandscoffee.vn', 4.7, ARRAY['https://www.cukcuk.vn/wp-content/uploads/2022/03/dia-diem-mo-chi-nhanh-highland.jpg'], '720A Dien Bien Phu', 'Ward 22', 'Binh Thanh District', 'Ho Chi Minh City', 10.794930, 106.721620, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000214', '21111111-1111-4111-8111-000000000106', 2, 'Highlands Coffee Ben Thanh', '02862744445', 'benthanh@highlandscoffee.vn', 4.6, ARRAY['https://chothuenhapho.vn/wp-content/uploads/2022/07/thuong-hieu-highlands-coffee.jpg'], '2 Le Loi', 'Ben Thanh', 'District 1', 'Ho Chi Minh City', 10.772560, 106.698410, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000215', '21111111-1111-4111-8111-000000000106', 3, 'Highlands Coffee Tan Son Nhat', '02862744446', 'airport@highlandscoffee.vn', 4.3, ARRAY['https://voz.vn/proxy.php?image=https%3A%2F%2Fphoto.znews.vn%2Fw960%2FUploaded%2Fmrndcqjwq%2F2024_11_11%2F439900233_834342558718755_7774630493963132817_n_2.jpg&hash=ffd0fe5e56c4e9099ebfcfe067993d7e'], '12 Truong Son', 'Ward 2', 'Tan Binh District', 'Ho Chi Minh City', 10.813210, 106.660050, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000216', '21111111-1111-4111-8111-000000000107', 1, 'Katinat Dong Khoi', '02866886688', 'dongkhoi@katinat.vn', 4.6, ARRAY['https://upload.urbox.vn/strapi/Gallery_Katinat_1_375aa9eded.jpg'], '91 Dong Khoi', 'Ben Nghe', 'District 1', 'Ho Chi Minh City', 10.776210, 106.704670, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000217', '21111111-1111-4111-8111-000000000107', 2, 'Katinat Phu Nhuan', '02866886689', 'phunhuan@katinat.vn', 4.4, ARRAY['https://cafefcdn.com/203337114487263232/2023/4/11/katinat-phu-nhuan-1681185124801-1681185124943230270335.jpeg'], '2 Le Van Sy', 'Ward 11', 'Phu Nhuan District', 'Ho Chi Minh City', 10.790210, 106.675210, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000218', '21111111-1111-4111-8111-000000000108', 1, 'Bonchon Vincom Dong Khoi', '02839393939', 'vincom@bonchon.vn', 4.5, ARRAY['https://admin.tamshoppe.vn/Web/Resources/Uploaded/2/images/bai-viet/trang-tri-giang-sinh-lung-linh-nha-hang-Bonchon-2.jpeg'], '72 Le Thanh Ton', 'Ben Nghe', 'District 1', 'Ho Chi Minh City', 10.779340, 106.703560, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000219', '21111111-1111-4111-8111-000000000108', 2, 'Bonchon Van Hanh Mall', '02839393938', 'vanhanh@bonchon.vn', 4.3, ARRAY['https://fnb.qdc.vn/pictures/catalog/nha-hang-han-quoc/bon-chon/thiet-ke-thi-cong-nha-hang-bon-chon-19.jpg'], '11 Su Van Hanh', 'Ward 12', 'District 10', 'Ho Chi Minh City', 10.772750, 106.668950, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000220', '21111111-1111-4111-8111-000000000109', 1, 'Texas Chicken Le Van Sy', '02838486666', 'levansy@texaschicken.vn', 4.4, ARRAY['https://aeonmall-hadong.com.vn/wp-content/uploads/2019/08/dsc00969-750x468.jpg'], '270 Le Van Sy', 'Ward 1', 'Tan Binh District', 'Ho Chi Minh City', 10.795330, 106.666420, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000221', '21111111-1111-4111-8111-000000000109', 2, 'Texas Chicken Di An', '02838486665', 'dian@texaschicken.vn', 4.2, ARRAY['https://aeonmall-binhduongcanary.com.vn/wp-content/uploads/2018/12/img_2003-360x225.jpeg'], '1B National Highway 1K', 'Dong Hoa', 'Di An City', 'Binh Duong Province', 10.904560, 106.772830, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000222', '21111111-1111-4111-8111-000000000110', 1, 'Pizza 4P''s Ben Thanh', '02836229988', 'benthanh@pizza4ps.com', 4.8, ARRAY['https://congchungnguyenhue.com/Uploaded/Images/Original/2023/11/03/thiet-ke-nha-hang-pizza4ps-6a_0311135318.png'], '8 Le Thanh Ton', 'Ben Nghe', 'District 1', 'Ho Chi Minh City', 10.775010, 106.704950, TRUE, TRUE),
  ('31111111-1111-4111-8111-000000000223', '21111111-1111-4111-8111-000000000110', 2, 'Pizza 4P''s Thao Dien', '02836229989', 'thaodien@pizza4ps.com', 4.7, ARRAY['https://vn.yamaha.com/vi/files/4p-2_f52edb9295b757e1b25b0739575ac9f1.jpg'], '151B Nguyen Van Huong', 'Thao Dien', 'Thu Duc City', 'Ho Chi Minh City', 10.802320, 106.735820, FALSE, TRUE),
  ('31111111-1111-4111-8111-000000000224', '21111111-1111-4111-8111-000000000110', 3, 'Pizza 4P''s Phu My Hung', '02836229990', 'phumyhung@pizza4ps.com', 4.6, ARRAY['https://dltm-cdn.vnptit3.vn/resources/portal//Images/HNI/Import/636500767462410572_restaurant_nh%C3%A0h%C3%A0ng_12052017102712301.jpg'], '10-12 Crescent Mall', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 10.728950, 106.716500, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- TAX TEMPLATES AND ASSIGNMENTS FOR SAMPLE RESTAURANTS
INSERT INTO tax_templates (id, code, name, description)
VALUES
  ('81111111-1111-4111-8111-000000000501', 'VAT7_DEFAULT', 'VAT 7% Standard', 'Standard VAT applied to dine-in and delivery orders.'),
  ('81111111-1111-4111-8111-000000000502', 'VAT10_BEVERAGE', 'Beverage VAT 10%', 'Higher VAT for premium beverages and cocktails.'),
  ('81111111-1111-4111-8111-000000000503', 'VAT0_PROMO', 'Promotional VAT Holiday', 'Limited-time zero VAT promotion.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO restaurant_tax_assignments (
  id,
  restaurant_id,
  tax_template_id,
  rate_percent,
  is_default,
  calendar_id,
  start_at,
  end_at,
  priority,
  is_active
)
VALUES
  ('92111111-1111-4111-8111-000000000601', '21111111-1111-4111-8111-000000000104', '81111111-1111-4111-8111-000000000501', 7.00, TRUE, NULL, NULL, NULL, 10, TRUE)
ON CONFLICT (restaurant_id, tax_template_id) DO UPDATE
  SET rate_percent = EXCLUDED.rate_percent,
      is_default = EXCLUDED.is_default,
      calendar_id = EXCLUDED.calendar_id,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      priority = EXCLUDED.priority,
      is_active = EXCLUDED.is_active,
      updated_at = now();

INSERT INTO branch_tax_assignments (
  id,
  branch_id,
  tax_template_id,
  rate_percent,
  is_default,
  calendar_id,
  start_at,
  end_at,
  priority,
  is_active
)
VALUES
  ('93111111-1111-4111-8111-000000000701', '31111111-1111-4111-8111-000000000208', '81111111-1111-4111-8111-000000000501', 7.00, TRUE, NULL, NULL, NULL, 10, TRUE),
  ('93111111-1111-4111-8111-000000000702', '31111111-1111-4111-8111-000000000209', '81111111-1111-4111-8111-000000000501', 7.00, TRUE, NULL, NULL, NULL, 10, TRUE),
  ('93111111-1111-4111-8111-000000000703', '31111111-1111-4111-8111-000000000210', '81111111-1111-4111-8111-000000000501', 7.00, TRUE, NULL, NULL, NULL, 10, TRUE),
  ('93111111-1111-4111-8111-000000000704', '31111111-1111-4111-8111-000000000210', '81111111-1111-4111-8111-000000000503', 0.00, FALSE, NULL, TIMESTAMPTZ '2025-03-01 00:00:00+07', TIMESTAMPTZ '2025-03-31 23:59:59+07', 5, TRUE)
ON CONFLICT (branch_id, tax_template_id) DO UPDATE
  SET rate_percent = EXCLUDED.rate_percent,
      is_default = EXCLUDED.is_default,
      calendar_id = EXCLUDED.calendar_id,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      priority = EXCLUDED.priority,
      is_active = EXCLUDED.is_active,
      updated_at = now();

INSERT INTO branch_product_tax_overrides (
  id,
  branch_id,
  product_id,
  tax_template_id,
  rate_percent,
  start_at,
  end_at,
  priority,
  is_active
)
VALUES
  ('94111111-1111-4111-8111-000000000801', '31111111-1111-4111-8111-000000000208', '51111111-1111-4111-8111-000000000408', '81111111-1111-4111-8111-000000000502', 10.00, NULL, NULL, 30, TRUE),
  ('94111111-1111-4111-8111-000000000802', '31111111-1111-4111-8111-000000000208', '51111111-1111-4111-8111-000000000409', '81111111-1111-4111-8111-000000000502', 10.00, NULL, NULL, 30, TRUE),
  ('94111111-1111-4111-8111-000000000803', '31111111-1111-4111-8111-000000000208', '51111111-1111-4111-8111-000000000410', '81111111-1111-4111-8111-000000000502', 10.00, NULL, NULL, 30, TRUE),
  ('94111111-1111-4111-8111-000000000804', '31111111-1111-4111-8111-000000000210', '51111111-1111-4111-8111-000000000410', '81111111-1111-4111-8111-000000000503', 0.00, TIMESTAMPTZ '2025-03-01 00:00:00+07', TIMESTAMPTZ '2025-03-31 23:59:59+07', 4, TRUE)
ON CONFLICT (branch_id, product_id, tax_template_id) DO UPDATE
  SET rate_percent = EXCLUDED.rate_percent,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      priority = EXCLUDED.priority,
      is_active = EXCLUDED.is_active,
      updated_at = now();

WITH target_branches(branch_id) AS (
  VALUES
    ('31111111-1111-4111-8111-000000000201'::uuid),
    ('31111111-1111-4111-8111-000000000202'::uuid),
    ('31111111-1111-4111-8111-000000000203'::uuid),
    ('31111111-1111-4111-8111-000000000204'::uuid),
    ('31111111-1111-4111-8111-000000000205'::uuid),
    ('31111111-1111-4111-8111-000000000206'::uuid),
    ('31111111-1111-4111-8111-000000000207'::uuid),
    ('31111111-1111-4111-8111-000000000208'::uuid),
    ('31111111-1111-4111-8111-000000000209'::uuid),
    ('31111111-1111-4111-8111-000000000210'::uuid),
    ('31111111-1111-4111-8111-000000000211'::uuid),
    ('31111111-1111-4111-8111-000000000212'::uuid),
    ('31111111-1111-4111-8111-000000000213'::uuid),
    ('31111111-1111-4111-8111-000000000214'::uuid),
    ('31111111-1111-4111-8111-000000000215'::uuid),
    ('31111111-1111-4111-8111-000000000216'::uuid),
    ('31111111-1111-4111-8111-000000000217'::uuid),
    ('31111111-1111-4111-8111-000000000218'::uuid),
    ('31111111-1111-4111-8111-000000000219'::uuid),
    ('31111111-1111-4111-8111-000000000220'::uuid),
    ('31111111-1111-4111-8111-000000000221'::uuid),
    ('31111111-1111-4111-8111-000000000222'::uuid),
    ('31111111-1111-4111-8111-000000000223'::uuid),
    ('31111111-1111-4111-8111-000000000224'::uuid)
)
INSERT INTO branch_opening_hours (branch_id, day_of_week, open_time, close_time, is_closed, overnight)
SELECT
  b.branch_id,
  gs,
  CASE WHEN gs IN (5, 6) THEN TIME '08:30' ELSE TIME '08:00' END,
  CASE WHEN gs IN (5, 6) THEN TIME '23:00' ELSE TIME '22:00' END,
  FALSE,
  FALSE
FROM target_branches b
CROSS JOIN generate_series(0, 6) AS gs
ON CONFLICT (branch_id, day_of_week) DO UPDATE
  SET open_time = EXCLUDED.open_time,
      close_time = EXCLUDED.close_time,
      is_closed = FALSE,
      overnight = FALSE,
      updated_at = now();

INSERT INTO categories (id, restaurant_id, name, description)
VALUES
  ('41111111-1111-4111-8111-000000000301', '21111111-1111-4111-8111-000000000101', 'Korean BBQ Classics', 'Signature grilled meats and hearty mains.'),
  ('41111111-1111-4111-8111-000000000302', '21111111-1111-4111-8111-000000000101', 'Street Food Favorites', 'Trending snacks and fast comfort dishes.'),
  ('41111111-1111-4111-8111-000000000303', '21111111-1111-4111-8111-000000000101', 'Sweet Treats', 'Desserts, bingsu and baked goods.'),
  ('41111111-1111-4111-8111-000000000304', '21111111-1111-4111-8111-000000000102', 'Signature Chicken', 'Original Recipe and spicy fried chicken buckets.'),
  ('41111111-1111-4111-8111-000000000305', '21111111-1111-4111-8111-000000000102', 'Burgers & Wraps', 'Handheld meals with fries and sides.'),
  ('41111111-1111-4111-8111-000000000306', '21111111-1111-4111-8111-000000000102', 'Sips & Sides', 'Mashed potatoes, salads and beverages.'),
  ('41111111-1111-4111-8111-000000000307', '21111111-1111-4111-8111-000000000103', 'Chicken Joy', 'Crispy chicken served with gravy and rice.'),
  ('41111111-1111-4111-8111-000000000308', '21111111-1111-4111-8111-000000000103', 'Rice Meals', 'Yumburger steaks, palabok and hearty plates.'),
  ('41111111-1111-4111-8111-000000000309', '21111111-1111-4111-8111-000000000103', 'Desserts & Palabok', 'Sweet pies, halo-halo and party trays.'),
  ('41111111-1111-4111-8111-000000000310', '21111111-1111-4111-8111-000000000104', 'Noodles', 'Hot and cold noodle bowls from Busan.'),
  ('41111111-1111-4111-8111-000000000311', '21111111-1111-4111-8111-000000000104', 'Hot Plates', 'Rice bowls, pancakes and shareable mains.'),
  ('41111111-1111-4111-8111-000000000312', '21111111-1111-4111-8111-000000000104', 'Beverages', 'House-made teas, ades and coffees.'),
  ('41111111-1111-4111-8111-000000000313', '21111111-1111-4111-8111-000000000105', 'Premium Broths', 'Signature Tom Yum and collagen broths.'),
  ('41111111-1111-4111-8111-000000000314', '21111111-1111-4111-8111-000000000105', 'Add-on Platters', 'Meats, seafood and vegetables for sharing.'),
  ('41111111-1111-4111-8111-000000000315', '21111111-1111-4111-8111-000000000105', 'Refreshments', 'Cold drinks to balance the spice.'),
  ('41111111-1111-4111-8111-000000000316', '21111111-1111-4111-8111-000000000106', 'Phin Coffee', 'Slow-dripped robusta coffee classics.'),
  ('41111111-1111-4111-8111-000000000317', '21111111-1111-4111-8111-000000000106', 'Tea & Freeze', 'Milk tea, iced tea and blended freeze beverages.'),
  ('41111111-1111-4111-8111-000000000318', '21111111-1111-4111-8111-000000000106', 'Bakery & Snacks', 'Cakes, croissants and savory bites.'),
  ('41111111-1111-4111-8111-000000000319', '21111111-1111-4111-8111-000000000107', 'Signature Drinks', 'Best-selling coffee and milk tea creations.'),
  ('41111111-1111-4111-8111-000000000320', '21111111-1111-4111-8111-000000000107', 'Cold Brew Lab', 'Slow-steeped cold brew menu.'),
  ('41111111-1111-4111-8111-000000000321', '21111111-1111-4111-8111-000000000107', 'Brunch Bites', 'Savory pastries and light brunch dishes.'),
  ('41111111-1111-4111-8111-000000000322', '21111111-1111-4111-8111-000000000108', 'Korean Chicken', 'Double-fried chicken with bold sauces.'),
  ('41111111-1111-4111-8111-000000000323', '21111111-1111-4111-8111-000000000108', 'Rice & Noodles', 'Korean comfort staples beyond chicken.'),
  ('41111111-1111-4111-8111-000000000324', '21111111-1111-4111-8111-000000000108', 'Appetizers', 'Shareable starters and sides.'),
  ('41111111-1111-4111-8111-000000000325', '21111111-1111-4111-8111-000000000109', 'Fried Chicken', 'Crispy fried chicken with honey butter biscuits.'),
  ('41111111-1111-4111-8111-000000000326', '21111111-1111-4111-8111-000000000109', 'Sandwiches', 'Cajun sandwiches and wraps.'),
  ('41111111-1111-4111-8111-000000000327', '21111111-1111-4111-8111-000000000109', 'Sides & Drinks', 'Fries, coleslaw and fountain drinks.'),
  ('41111111-1111-4111-8111-000000000328', '21111111-1111-4111-8111-000000000110', 'Artisan Pizza', 'Wood-fired pizzas with house-made cheese.'),
  ('41111111-1111-4111-8111-000000000329', '21111111-1111-4111-8111-000000000110', 'Pasta & Lasagna', 'Fresh pasta and baked lasagna specialties.'),
  ('41111111-1111-4111-8111-000000000330', '21111111-1111-4111-8111-000000000110', 'Desserts & Cheese', 'Desserts, tiramisu and premium cheese boards.')
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO branch_category_assignments (branch_id, category_id, is_visible, is_active, display_order)
VALUES
  ('31111111-1111-4111-8111-000000000201', '41111111-1111-4111-8111-000000000301', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000201', '41111111-1111-4111-8111-000000000302', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000201', '41111111-1111-4111-8111-000000000303', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000202', '41111111-1111-4111-8111-000000000301', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000202', '41111111-1111-4111-8111-000000000302', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000202', '41111111-1111-4111-8111-000000000303', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000203', '41111111-1111-4111-8111-000000000301', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000203', '41111111-1111-4111-8111-000000000302', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000203', '41111111-1111-4111-8111-000000000303', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000204', '41111111-1111-4111-8111-000000000304', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000204', '41111111-1111-4111-8111-000000000305', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000204', '41111111-1111-4111-8111-000000000306', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000205', '41111111-1111-4111-8111-000000000304', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000205', '41111111-1111-4111-8111-000000000305', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000205', '41111111-1111-4111-8111-000000000306', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000206', '41111111-1111-4111-8111-000000000307', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000206', '41111111-1111-4111-8111-000000000308', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000206', '41111111-1111-4111-8111-000000000309', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000207', '41111111-1111-4111-8111-000000000307', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000207', '41111111-1111-4111-8111-000000000308', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000207', '41111111-1111-4111-8111-000000000309', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000208', '41111111-1111-4111-8111-000000000310', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000208', '41111111-1111-4111-8111-000000000311', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000208', '41111111-1111-4111-8111-000000000312', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000209', '41111111-1111-4111-8111-000000000310', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000209', '41111111-1111-4111-8111-000000000311', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000209', '41111111-1111-4111-8111-000000000312', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000210', '41111111-1111-4111-8111-000000000310', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000210', '41111111-1111-4111-8111-000000000311', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000210', '41111111-1111-4111-8111-000000000312', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000211', '41111111-1111-4111-8111-000000000313', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000211', '41111111-1111-4111-8111-000000000314', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000211', '41111111-1111-4111-8111-000000000315', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000212', '41111111-1111-4111-8111-000000000313', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000212', '41111111-1111-4111-8111-000000000314', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000212', '41111111-1111-4111-8111-000000000315', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000213', '41111111-1111-4111-8111-000000000316', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000213', '41111111-1111-4111-8111-000000000317', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000213', '41111111-1111-4111-8111-000000000318', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000214', '41111111-1111-4111-8111-000000000316', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000214', '41111111-1111-4111-8111-000000000317', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000214', '41111111-1111-4111-8111-000000000318', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000215', '41111111-1111-4111-8111-000000000316', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000215', '41111111-1111-4111-8111-000000000317', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000215', '41111111-1111-4111-8111-000000000318', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000216', '41111111-1111-4111-8111-000000000319', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000216', '41111111-1111-4111-8111-000000000320', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000216', '41111111-1111-4111-8111-000000000321', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000217', '41111111-1111-4111-8111-000000000319', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000217', '41111111-1111-4111-8111-000000000320', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000217', '41111111-1111-4111-8111-000000000321', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000218', '41111111-1111-4111-8111-000000000322', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000218', '41111111-1111-4111-8111-000000000323', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000218', '41111111-1111-4111-8111-000000000324', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000219', '41111111-1111-4111-8111-000000000322', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000219', '41111111-1111-4111-8111-000000000323', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000219', '41111111-1111-4111-8111-000000000324', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000220', '41111111-1111-4111-8111-000000000325', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000220', '41111111-1111-4111-8111-000000000326', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000220', '41111111-1111-4111-8111-000000000327', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000221', '41111111-1111-4111-8111-000000000325', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000221', '41111111-1111-4111-8111-000000000326', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000221', '41111111-1111-4111-8111-000000000327', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000222', '41111111-1111-4111-8111-000000000328', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000222', '41111111-1111-4111-8111-000000000329', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000222', '41111111-1111-4111-8111-000000000330', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000223', '41111111-1111-4111-8111-000000000328', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000223', '41111111-1111-4111-8111-000000000329', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000223', '41111111-1111-4111-8111-000000000330', TRUE, TRUE, 3),
  ('31111111-1111-4111-8111-000000000224', '41111111-1111-4111-8111-000000000328', TRUE, TRUE, 1),
  ('31111111-1111-4111-8111-000000000224', '41111111-1111-4111-8111-000000000329', TRUE, TRUE, 2),
  ('31111111-1111-4111-8111-000000000224', '41111111-1111-4111-8111-000000000330', TRUE, TRUE, 3)
ON CONFLICT (branch_id, category_id) DO NOTHING;

INSERT INTO products (
  id,
  restaurant_id,
  title,
  description,
  images,
  type,
  category_id,
  base_price,
  popular,
  available,
  is_visible
)
VALUES
  ('51111111-1111-4111-8111-000000000401', '21111111-1111-4111-8111-000000000104', 'Busan Cold Buckwheat Noodles', 'Icy soba-style noodles with house chili vinegar, julienned cucumber and pear.', ARRAY['https://live.staticflickr.com/65535/53448879705_aa3a054e76_b.jpg'], 'food', '41111111-1111-4111-8111-000000000310', 95000, TRUE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000402', '21111111-1111-4111-8111-000000000104', 'Spicy Seafood Ramen', 'Piping hot ramen with squid, mussels and Busan-style chili broth.', ARRAY['https://i.redd.it/c06vx9t0me1c1.jpg'], 'food', '41111111-1111-4111-8111-000000000310', 105000, TRUE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000403', '21111111-1111-4111-8111-000000000104', 'Kimchi Beef Bibimbap', 'Stone bowl rice with marinated beef, vegetables and gochujang.', ARRAY['https://media.hellofresh.com/f_auto,fl_lossy,q_auto,w_1200/hellofresh_s3/image/korean-beef-bibimbap-4dba0ef9.jpg'], 'food', '41111111-1111-4111-8111-000000000311', 99000, TRUE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000404', '21111111-1111-4111-8111-000000000104', 'Bulgogi Rice Bowl', 'Flame-grilled bulgogi beef served over steamed rice and pickles.', ARRAY['https://beyond-meat-cms-production.s3.us-west-2.amazonaws.com/28b0fb63-31c0-4734-ac01-e37ff57a2ffa.jpg'], 'food', '41111111-1111-4111-8111-000000000311', 115000, FALSE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000405', '21111111-1111-4111-8111-000000000104', 'Korean Fried Chicken', 'Crispy soy-garlic chicken glazed to order.', ARRAY['https://static.hawonkoo.vn/hwk02/images/2023/10/cach-lam-ga-ran-kfc-bang-noi-chien-khong-dau-2.jpg'], 'food', '41111111-1111-4111-8111-000000000311', 129000, TRUE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000406', '21111111-1111-4111-8111-000000000104', 'Cheesy Tteokbokki', 'Rice cakes simmered in gochujang sauce topped with mozzarella.', ARRAY['https://eatdoro.com/cdn/shop/files/Doro_Tteokbokki-Med_03-06-23_80414eaa-3156-4944-ada1-e4ca1a6aca83.png?v=1722088558'], 'food', '41111111-1111-4111-8111-000000000311', 85000, FALSE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000407', '21111111-1111-4111-8111-000000000104', 'Seafood Pancake', 'Crispy haemul pajeon with spring onion and dipping sauce.', ARRAY['https://www.womanblitz.com/images/blog/2020/2021/cq5dam_thumbnail_400.400.png'], 'food', '41111111-1111-4111-8111-000000000311', 99000, FALSE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000408', '21111111-1111-4111-8111-000000000104', 'Yuzu Iced Tea', 'Refreshing yuzu citrus tea shaken with orange pulp.', ARRAY['https://www.yuzuyuzu.cz/fileadmin/_processed_/c/d/csm_yuzu-tea-honey-cold_63b21e5dce.jpg'], 'drink', '41111111-1111-4111-8111-000000000312', 65000, TRUE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000409', '21111111-1111-4111-8111-000000000104', 'Plum Sparkling Ade', 'Fizzy Korean maesil plum cooler with shiso leaves.', ARRAY['https://contents.sixshop.com/thumbnails/uploadedFiles/103270/product/image_1580444018699_750.jpg'], 'drink', '41111111-1111-4111-8111-000000000312', 68000, FALSE, TRUE, TRUE),
  ('51111111-1111-4111-8111-000000000410', '21111111-1111-4111-8111-000000000104', 'Dalgona Coffee Latte', 'Cold brew latte topped with whipped dalgona foam.', ARRAY['https://thesubversivetable.com/wp-content/uploads/2023/05/Dalgona-Latte-square-scaled.jpg'], 'drink', '41111111-1111-4111-8111-000000000312', 72000, TRUE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

WITH busan_branch_products AS (
  SELECT *
  FROM (
    VALUES
      ('61111111-1111-4111-8111-000000000701'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000401'::uuid, 1, TRUE, 48, 5, 10, 90, 99000),
      ('61111111-1111-4111-8111-000000000702'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000402'::uuid, 2, TRUE, 45, 5, 10, 90, 112000),
      ('61111111-1111-4111-8111-000000000703'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000403'::uuid, 3, FALSE, 40, 4, 10, 90, 101000),
      ('61111111-1111-4111-8111-000000000704'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000404'::uuid, 4, FALSE, 42, 4, 10, 90, 119000),
      ('61111111-1111-4111-8111-000000000705'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000405'::uuid, 5, TRUE, 38, 5, 10, 90, 135000),
      ('61111111-1111-4111-8111-000000000706'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000406'::uuid, 6, FALSE, 50, 5, 10, 90, 88000),
      ('61111111-1111-4111-8111-000000000707'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000407'::uuid, 7, FALSE, 36, 3, 10, 90, 102000),
      ('61111111-1111-4111-8111-000000000708'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000408'::uuid, 8, TRUE, 70, 4, 10, 120, 68000),
      ('61111111-1111-4111-8111-000000000709'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000409'::uuid, 9, FALSE, 68, 4, 10, 120, 71000),
      ('61111111-1111-4111-8111-000000000710'::uuid, '31111111-1111-4111-8111-000000000208'::uuid, '51111111-1111-4111-8111-000000000410'::uuid, 10, FALSE, 65, 4, 10, 120, 75000),
      ('61111111-1111-4111-8111-000000000711'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000401'::uuid, 1, FALSE, 40, 4, 10, 80, 95000),
      ('61111111-1111-4111-8111-000000000712'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000402'::uuid, 2, FALSE, 38, 4, 10, 80, 105000),
      ('61111111-1111-4111-8111-000000000713'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000403'::uuid, 3, FALSE, 35, 3, 10, 80, 98000),
      ('61111111-1111-4111-8111-000000000714'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000404'::uuid, 4, FALSE, 37, 3, 10, 80, 113000),
      ('61111111-1111-4111-8111-000000000715'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000405'::uuid, 5, FALSE, 34, 3, 10, 80, 129000),
      ('61111111-1111-4111-8111-000000000716'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000406'::uuid, 6, FALSE, 36, 3, 10, 80, 84000),
      ('61111111-1111-4111-8111-000000000717'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000407'::uuid, 7, FALSE, 32, 2, 10, 80, 97000),
      ('61111111-1111-4111-8111-000000000718'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000408'::uuid, 8, FALSE, 55, 3, 10, 110, 65000),
      ('61111111-1111-4111-8111-000000000719'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000409'::uuid, 9, FALSE, 53, 3, 10, 110, 67000),
      ('61111111-1111-4111-8111-000000000720'::uuid, '31111111-1111-4111-8111-000000000209'::uuid, '51111111-1111-4111-8111-000000000410'::uuid, 10, FALSE, 52, 3, 10, 110, 70000),
      ('61111111-1111-4111-8111-000000000721'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000401'::uuid, 1, FALSE, 34, 3, 10, 70, 92000),
      ('61111111-1111-4111-8111-000000000722'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000402'::uuid, 2, FALSE, 32, 3, 10, 70, 99000),
      ('61111111-1111-4111-8111-000000000723'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000403'::uuid, 3, FALSE, 31, 3, 10, 70, 94000),
      ('61111111-1111-4111-8111-000000000724'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000404'::uuid, 4, FALSE, 30, 2, 10, 70, 108000),
      ('61111111-1111-4111-8111-000000000725'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000405'::uuid, 5, FALSE, 28, 2, 10, 70, 122000),
      ('61111111-1111-4111-8111-000000000726'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000406'::uuid, 6, FALSE, 29, 2, 10, 70, 81000),
      ('61111111-1111-4111-8111-000000000727'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000407'::uuid, 7, FALSE, 27, 2, 10, 70, 93000),
      ('61111111-1111-4111-8111-000000000728'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000408'::uuid, 8, FALSE, 48, 2, 10, 100, 62000),
      ('61111111-1111-4111-8111-000000000729'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000409'::uuid, 9, FALSE, 46, 2, 10, 100, 64000),
      ('61111111-1111-4111-8111-000000000730'::uuid, '31111111-1111-4111-8111-000000000210'::uuid, '51111111-1111-4111-8111-000000000410'::uuid, 10, FALSE, 45, 2, 10, 100, 68000)
  ) AS t(
    branch_product_id,
    branch_id,
    product_id,
    display_order,
    is_featured,
    quantity,
    reserved_qty,
    min_stock,
    daily_limit,
    price_override
  )
),
upsert_branch_products AS (
  INSERT INTO branch_products (
    id,
    branch_id,
    product_id,
    is_available,
    is_visible,
    is_featured,
    display_order,
    price_mode,
    base_price_override,
    local_name,
    local_description
  )
  SELECT
    branch_product_id,
    branch_id,
    product_id,
    TRUE,
    TRUE,
    is_featured,
    display_order,
    CASE WHEN price_override IS NULL THEN 'inherit' ELSE 'override' END,
    price_override,
    NULL,
    NULL
  FROM busan_branch_products
  ON CONFLICT (branch_id, product_id) DO UPDATE
    SET is_visible = EXCLUDED.is_visible,
        is_featured = EXCLUDED.is_featured,
        updated_at = now()
  RETURNING id AS branch_product_id

)
INSERT INTO inventory (
  branch_product_id,
  quantity,
  reserved_qty,
  min_stock,
  daily_limit,
  daily_sold,
  is_visible,
  is_active,
  last_restock_at
)
SELECT
  bp.branch_product_id,
  bp.quantity,
  bp.reserved_qty,
  bp.min_stock,
  bp.daily_limit,
  0,
  TRUE,
  TRUE,
  now()
FROM busan_branch_products bp
LEFT JOIN upsert_branch_products ubp ON ubp.branch_product_id = bp.branch_product_id
ON CONFLICT (branch_product_id) DO UPDATE
  SET quantity = EXCLUDED.quantity,
      reserved_qty = EXCLUDED.reserved_qty,
      min_stock = EXCLUDED.min_stock,
      daily_limit = EXCLUDED.daily_limit,
      updated_at = now();

INSERT INTO option_groups (
  id,
  restaurant_id,
  name,
  description,
  selection_type,
  min_select,
  max_select,
  is_required,
  is_active
)
VALUES
  ('81111111-1111-4111-8111-000000000601', '21111111-1111-4111-8111-000000000104', 'Size', 'Choose preferred portion size.', 'single', 1, 1, TRUE, TRUE),
  ('81111111-1111-4111-8111-000000000602', '21111111-1111-4111-8111-000000000104', 'Topping', 'Add-ons to compliment your dish.', 'multiple', 0, 3, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO option_items (
  id,
  group_id,
  name,
  description,
  price_delta,
  is_active,
  display_order
)
VALUES
  ('82111111-1111-4111-8111-000000000611', '81111111-1111-4111-8111-000000000601', 'Regular', 'Standard serving size.', 0, TRUE, 1),
  ('82111111-1111-4111-8111-000000000612', '81111111-1111-4111-8111-000000000601', 'Large', 'Larger portion with extra noodles or rice.', 15000, TRUE, 2),
  ('82111111-1111-4111-8111-000000000613', '81111111-1111-4111-8111-000000000602', 'Soft-boiled Egg', 'Tamago style egg.', 10000, TRUE, 1),
  ('82111111-1111-4111-8111-000000000614', '81111111-1111-4111-8111-000000000602', 'Extra Kimchi', 'House fermented cabbage.', 8000, TRUE, 2),
  ('82111111-1111-4111-8111-000000000615', '81111111-1111-4111-8111-000000000602', 'Mozzarella Cheese', 'Melted cheese topping.', 12000, TRUE, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_option_groups (
  id,
  product_id,
  group_id,
  min_select,
  max_select,
  is_required,
  display_order,
  is_active
)
VALUES
  ('83111111-1111-4111-8111-000000000701', '51111111-1111-4111-8111-000000000401', '81111111-1111-4111-8111-000000000601', 1, 1, TRUE, 1, TRUE),
  ('83111111-1111-4111-8111-000000000702', '51111111-1111-4111-8111-000000000401', '81111111-1111-4111-8111-000000000602', 0, 3, FALSE, 2, TRUE),
  ('83111111-1111-4111-8111-000000000703', '51111111-1111-4111-8111-000000000402', '81111111-1111-4111-8111-000000000601', 1, 1, TRUE, 1, TRUE),
  ('83111111-1111-4111-8111-000000000704', '51111111-1111-4111-8111-000000000402', '81111111-1111-4111-8111-000000000602', 0, 3, FALSE, 2, TRUE),
  ('83111111-1111-4111-8111-000000000705', '51111111-1111-4111-8111-000000000403', '81111111-1111-4111-8111-000000000601', 1, 1, TRUE, 1, TRUE),
  ('83111111-1111-4111-8111-000000000706', '51111111-1111-4111-8111-000000000403', '81111111-1111-4111-8111-000000000602', 0, 3, FALSE, 2, TRUE),
  ('83111111-1111-4111-8111-000000000707', '51111111-1111-4111-8111-000000000404', '81111111-1111-4111-8111-000000000601', 1, 1, TRUE, 1, TRUE),
  ('83111111-1111-4111-8111-000000000708', '51111111-1111-4111-8111-000000000404', '81111111-1111-4111-8111-000000000602', 0, 3, FALSE, 2, TRUE),
  ('83111111-1111-4111-8111-000000000709', '51111111-1111-4111-8111-000000000405', '81111111-1111-4111-8111-000000000601', 1, 1, TRUE, 1, TRUE),
  ('83111111-1111-4111-8111-00000000070A', '51111111-1111-4111-8111-000000000405', '81111111-1111-4111-8111-000000000602', 0, 3, FALSE, 2, TRUE),
  ('83111111-1111-4111-8111-00000000070B', '51111111-1111-4111-8111-000000000406', '81111111-1111-4111-8111-000000000601', 1, 1, TRUE, 1, TRUE),
  ('83111111-1111-4111-8111-00000000070C', '51111111-1111-4111-8111-000000000406', '81111111-1111-4111-8111-000000000602', 0, 3, FALSE, 2, TRUE),
  ('83111111-1111-4111-8111-00000000070D', '51111111-1111-4111-8111-000000000407', '81111111-1111-4111-8111-000000000601', 1, 1, TRUE, 1, TRUE),
  ('83111111-1111-4111-8111-00000000070E', '51111111-1111-4111-8111-000000000407', '81111111-1111-4111-8111-000000000602', 0, 3, FALSE, 2, TRUE)
ON CONFLICT (product_id, group_id) DO NOTHING;

INSERT INTO branch_product_option_items (
  id,
  branch_product_id,
  option_item_id,
  price_delta,
  is_active,
  created_at
)
SELECT
  gen_random_uuid(),
  bp.id AS branch_product_id,
  oi.id AS option_item_id,
  oi.price_delta,
  TRUE,
  now()
FROM branch_products bp
JOIN product_option_groups pog ON pog.product_id = bp.product_id
JOIN option_items oi ON oi.group_id = pog.group_id
WHERE bp.branch_id IN (
  '31111111-1111-4111-8111-000000000208',  -- Busan Bistro Nguyễn Huệ
  '31111111-1111-4111-8111-000000000209',  -- Busan Bistro Thảo Điền
  '31111111-1111-4111-8111-000000000210'   -- Busan Bistro Phú Mỹ Hưng
)
AND pog.is_active = TRUE
AND oi.is_active = TRUE
ON CONFLICT (branch_product_id, option_item_id) DO NOTHING;

INSERT INTO branch_product_option_groups (
  id,
  branch_product_id,
  option_group_id,
  min_select,
  max_select,
  is_required,
  display_order,
  is_active
)
SELECT
  gen_random_uuid(),
  bp.id,
  pog.group_id,
  pog.min_select,
  pog.max_select,
  pog.is_required,
  pog.display_order,
  TRUE
FROM branch_products bp
JOIN product_option_groups pog ON pog.product_id = bp.product_id
WHERE bp.branch_id IN (
  '31111111-1111-4111-8111-000000000208',
  '31111111-1111-4111-8111-000000000209',
  '31111111-1111-4111-8111-000000000210'
)
AND pog.is_active = TRUE
ON CONFLICT (branch_product_id, option_group_id) DO NOTHING;


INSERT INTO combos (
  id,
  restaurant_id,
  name,
  description,
  base_price,
  images,
  is_active
)
VALUES
  ('71111111-1111-4111-8111-000000000701', '21111111-1111-4111-8111-000000000104', 'Busan Lunch Combo', 'Choose one noodle bowl and any iced drink for a quick lunch.', 165000, ARRAY['https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80'], TRUE),
  ('71111111-1111-4111-8111-000000000702', '21111111-1111-4111-8111-000000000104', 'Busan Sharing Set', 'Two hot plates and a shareable beverage for evening dining.', 285000, ARRAY['https://images.unsplash.com/photo-1608032362155-c86a8137b0ae?auto=format&fit=crop&w=900&q=80'], TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO combo_groups (
  id,
  combo_id,
  name,
  min_select,
  max_select,
  required,
  display_order
)
VALUES
  ('72111111-1111-4111-8111-000000000711', '71111111-1111-4111-8111-000000000701', 'Main Dish', 1, 1, TRUE, 1),
  ('72111111-1111-4111-8111-000000000712', '71111111-1111-4111-8111-000000000701', 'Drink', 1, 1, TRUE, 2),
  ('72111111-1111-4111-8111-000000000713', '71111111-1111-4111-8111-000000000702', 'Hot Plates', 2, 2, TRUE, 1),
  ('72111111-1111-4111-8111-000000000714', '71111111-1111-4111-8111-000000000702', 'Beverage', 1, 1, TRUE, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO combo_group_items (
  id,
  combo_group_id,
  item_type,
  product_id,
  category_id,
  extra_price
)
VALUES
  ('73111111-1111-4111-8111-000000000721', '72111111-1111-4111-8111-000000000711', 'product', '51111111-1111-4111-8111-000000000401', NULL, 0),
  ('73111111-1111-4111-8111-000000000722', '72111111-1111-4111-8111-000000000711', 'product', '51111111-1111-4111-8111-000000000402', NULL, 0),
  ('73111111-1111-4111-8111-000000000723', '72111111-1111-4111-8111-000000000711', 'product', '51111111-1111-4111-8111-000000000404', NULL, 5000),
  ('73111111-1111-4111-8111-000000000724', '72111111-1111-4111-8111-000000000712', 'product', '51111111-1111-4111-8111-000000000408', NULL, 0),
  ('73111111-1111-4111-8111-000000000725', '72111111-1111-4111-8111-000000000712', 'product', '51111111-1111-4111-8111-000000000409', NULL, 0),
  ('73111111-1111-4111-8111-000000000726', '72111111-1111-4111-8111-000000000712', 'product', '51111111-1111-4111-8111-000000000410', NULL, 5000),
  ('73111111-1111-4111-8111-000000000727', '72111111-1111-4111-8111-000000000713', 'product', '51111111-1111-4111-8111-000000000403', NULL, 0),
  ('73111111-1111-4111-8111-000000000728', '72111111-1111-4111-8111-000000000713', 'product', '51111111-1111-4111-8111-000000000404', NULL, 0),
  ('73111111-1111-4111-8111-000000000729', '72111111-1111-4111-8111-000000000713', 'product', '51111111-1111-4111-8111-000000000405', NULL, 10000),
  ('73111111-1111-4111-8111-00000000072A', '72111111-1111-4111-8111-000000000713', 'product', '51111111-1111-4111-8111-000000000406', NULL, 0),
  ('73111111-1111-4111-8111-00000000072B', '72111111-1111-4111-8111-000000000713', 'product', '51111111-1111-4111-8111-000000000407', NULL, 0),
  ('73111111-1111-4111-8111-00000000072C', '72111111-1111-4111-8111-000000000714', 'product', '51111111-1111-4111-8111-000000000408', NULL, 0),
  ('73111111-1111-4111-8111-00000000072D', '72111111-1111-4111-8111-000000000714', 'product', '51111111-1111-4111-8111-000000000409', NULL, 0),
  ('73111111-1111-4111-8111-00000000072E', '72111111-1111-4111-8111-000000000714', 'product', '51111111-1111-4111-8111-000000000410', NULL, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO branch_combos (
  branch_id,
  combo_id,
  is_available,
  is_visible,
  base_price_override,
  display_order
)
VALUES
  ('31111111-1111-4111-8111-000000000208', '71111111-1111-4111-8111-000000000701', TRUE, TRUE, NULL, 1),
  ('31111111-1111-4111-8111-000000000208', '71111111-1111-4111-8111-000000000702', TRUE, TRUE, NULL, 2),
  ('31111111-1111-4111-8111-000000000209', '71111111-1111-4111-8111-000000000701', TRUE, TRUE, NULL, 1),
  ('31111111-1111-4111-8111-000000000209', '71111111-1111-4111-8111-000000000702', TRUE, TRUE, NULL, 2),
  ('31111111-1111-4111-8111-000000000210', '71111111-1111-4111-8111-000000000701', TRUE, TRUE, NULL, 1),
  ('31111111-1111-4111-8111-000000000210', '71111111-1111-4111-8111-000000000702', TRUE, TRUE, NULL, 2)
ON CONFLICT (branch_id, combo_id) DO NOTHING;

WITH cal AS (
  INSERT INTO calendars (name, scope_type, is_active)
  VALUES ('VN Holidays 2025', 'global', TRUE)
  RETURNING id
)
INSERT INTO calendar_dates (calendar_id, on_date, start_date, end_date, label, is_holiday)
-- TẾT DƯƠNG LỊCH: 3 ngày
SELECT id, DATE '2025-01-01', DATE '2025-01-01', DATE '2025-01-03', 
       'Tết Dương lịch (01–03/01/2025)', TRUE FROM cal

UNION ALL
-- VALENTINE
SELECT id, DATE '2025-02-14', NULL, NULL, 'Valentine (14/2)', TRUE FROM cal

UNION ALL
-- QUỐC TẾ PHỤ NỮ
SELECT id, DATE '2025-03-08', NULL, NULL, 'Quốc tế Phụ nữ (8/3)', TRUE FROM cal

UNION ALL
-- 30/4 – 1/5 nghỉ liền kề
SELECT id, DATE '2025-04-30', DATE '2025-04-30', DATE '2025-05-01', 
       '30/4 – 1/5: Giải phóng miền Nam & Quốc tế Lao động', TRUE FROM cal

UNION ALL
-- QUỐC TẾ THIẾU NHI
SELECT id, DATE '2025-06-01', NULL, NULL, 'Quốc tế Thiếu nhi (1/6)', TRUE FROM cal

UNION ALL
-- TRUNG THU
SELECT id, DATE '2025-10-06', NULL, NULL, 'Tết Trung Thu (Rằm tháng 8)', TRUE FROM cal

UNION ALL
-- 20/10
SELECT id, DATE '2025-10-20', NULL, NULL, 'Ngày Phụ nữ Việt Nam (20/10)', TRUE FROM cal

UNION ALL
-- HALLOWEEN
SELECT id, DATE '2025-10-30', DATE '2025-10-30', DATE '2025-10-31', 'Halloween (31/10)', TRUE FROM cal

UNION ALL
-- NOEL
SELECT id, DATE '2025-12-24', DATE '2025-12-24', DATE '2025-12-25', 'Giáng Sinh (Noel)', TRUE FROM cal

UNION ALL
-- TẾT ÂM LỊCH (5 ngày nghỉ: 29/01–02/02/2025)
SELECT id, DATE '2025-01-29', DATE '2025-01-29', DATE '2025-02-08',
       'Tết Nguyên Đán (Âm lịch: 29/01–08/02/2025)', TRUE FROM cal;
