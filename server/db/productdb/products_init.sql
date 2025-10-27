-- -- =========================================
-- -- BẬT EXTENSION UUID
-- -- =========================================
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- -- =========================================
-- -- 1) NHÀ HÀNG / THƯƠNG HIỆU
-- -- =========================================
-- CREATE TABLE IF NOT EXISTS restaurants (
--   id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   owner_id             UUID NOT NULL, 
--   name                 VARCHAR(150) NOT NULL,
--   description          TEXT,
--   about                TEXT,
--   cuisine              VARCHAR(100),                 -- loại ẩm thực chính
--   phone                VARCHAR(50),                  -- hotline/CSKH
--   email                VARCHAR(150),                 -- email CSKH
--   logo                 TEXT[],
--   images               TEXT[],                       -- ảnh thương hiệu
--   is_active            BOOLEAN DEFAULT TRUE,         -- thương hiệu còn hoạt động?
--   avg_branch_rating    NUMERIC(3,2) NOT NULL DEFAULT 0,  -- điểm TB của toàn bộ chi nhánh
--   total_branch_ratings INT NOT NULL DEFAULT 0,          -- số chi nhánh có rating > 0
--   created_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at           TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- CREATE INDEX IF NOT EXISTS idx_restaurants_name     ON restaurants(name);
-- CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine  ON restaurants(cuisine);
-- CREATE INDEX IF NOT EXISTS idx_restaurants_owner    ON restaurants(owner_id);

-- -- =========================================
-- -- 2) CHI NHÁNH CỦA THƯƠNG HIỆU
-- -- =========================================
-- CREATE TABLE IF NOT EXISTS restaurant_branches (
--   id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
--   branch_number  INT NOT NULL,                 -- mã chi nhánh nội bộ
--   name           VARCHAR(150),                 -- tên hiển thị chi nhánh
--   branch_phone   VARCHAR(50),
--   branch_email   VARCHAR(150),
--   rating         NUMERIC(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
--   images         TEXT[],                       -- hình ảnh riêng của chi nhánh
--   street         VARCHAR(200) NOT NULL,
--   ward           VARCHAR(100),
--   district       VARCHAR(100),
--   city           VARCHAR(100),
--   latitude       NUMERIC(9,6),
--   longitude      NUMERIC(9,6),
--   is_primary     BOOLEAN DEFAULT FALSE,
--   is_open        BOOLEAN DEFAULT FALSE,
--   created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   CONSTRAINT uq_branch_per_restaurant UNIQUE (restaurant_id, branch_number)
-- );

-- CREATE INDEX IF NOT EXISTS idx_branches_restaurant   ON restaurant_branches(restaurant_id);
-- CREATE INDEX IF NOT EXISTS idx_branches_city         ON restaurant_branches(city, district);
-- CREATE INDEX IF NOT EXISTS idx_branches_rating       ON restaurant_branches(rating DESC);
-- CREATE INDEX IF NOT EXISTS idx_branches_is_primary   ON restaurant_branches(restaurant_id, is_primary);

-- -- ============================================================
-- -- 3) GIỜ MỞ CỬA THEO NGÀY TRONG TUẦN
-- -- ============================================================
-- CREATE TABLE IF NOT EXISTS branch_opening_hours (
--   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   branch_id   UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
--   day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
--   open_time   TIME,
--   close_time  TIME,
--   is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
--   overnight   BOOLEAN NOT NULL DEFAULT FALSE,
--   created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   CONSTRAINT uq_hours UNIQUE (branch_id, day_of_week)
-- );

-- CREATE INDEX IF NOT EXISTS idx_hours_branch ON branch_opening_hours(branch_id, day_of_week);

-- -- ============================================================
-- -- 4) GIỜ MỞ CỬA ĐẶC BIỆT (NGÀY LỄ / SỰ KIỆN)
-- -- ============================================================
-- CREATE TABLE IF NOT EXISTS branch_special_hours (
--   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   branch_id   UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
--   on_date     DATE NOT NULL,
--   open_time   TIME,
--   close_time  TIME,
--   is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
--   overnight   BOOLEAN NOT NULL DEFAULT FALSE,
--   note        VARCHAR(200),
--   created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   CONSTRAINT uq_special UNIQUE (branch_id, on_date)
-- );

-- CREATE INDEX IF NOT EXISTS idx_special_hours_branch_date ON branch_special_hours(branch_id, on_date);

-- -- ============================================================
-- -- 5) ĐÁNH GIÁ CHI NHÁNH (branch_rating)
-- -- ============================================================
-- CREATE TABLE IF NOT EXISTS branch_rating (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   -- Liên kết đến chi nhánh (branch)
--   branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,

--   -- Liên kết đến người dùng (từ user-service)
--   user_id UUID NOT NULL,

--   -- Liên kết đến đơn hàng (từ order-service)
--   order_id UUID NOT NULL,

--   -- Thông tin đánh giá
--   rating_value INT CHECK (rating_value BETWEEN 1 AND 5),
--   comment TEXT,
--   image_url TEXT,

--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

--   CONSTRAINT uq_branch_rating UNIQUE (branch_id, user_id, order_id)
-- );

-- CREATE INDEX IF NOT EXISTS idx_branch_rating_branch  ON branch_rating(branch_id);
-- CREATE INDEX IF NOT EXISTS idx_branch_rating_user    ON branch_rating(user_id);
-- CREATE INDEX IF NOT EXISTS idx_branch_rating_order   ON branch_rating(order_id);

-- -- ============================================================
-- -- 6) BẢNG TRUNG BÌNH RATING CHI NHÁNH (branch_rating_avg)
-- -- ============================================================
-- CREATE TABLE IF NOT EXISTS branch_rating_avg (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   branch_id UUID NOT NULL UNIQUE REFERENCES restaurant_branches(id) ON DELETE CASCADE,
--   avg_rating NUMERIC(3,2) DEFAULT 0,
--   total_ratings INT DEFAULT 0,
--   last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- =========================================
-- -- 7) DANH MỤC SẢN PHẨM
-- -- =========================================
-- CREATE TABLE IF NOT EXISTS categories (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name VARCHAR(100) UNIQUE NOT NULL,      -- Tên danh mục (VD: Lẩu, Đồ uống, Tráng miệng)
--   description TEXT,                       -- Mô tả chi tiết danh mục
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- =========================================
-- -- 8) SẢN PHẨM
-- -- =========================================
-- CREATE TABLE IF NOT EXISTS products (
--   id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

--   -- 🥘 Thông tin sản phẩm
--   title           VARCHAR(200) NOT NULL,         -- Tên món ăn
--   description     TEXT,                          -- Mô tả chi tiết
--   images          TEXT[],                        -- Ảnh sản phẩm
--   type            VARCHAR(50),                   -- Loại (combo, topping, món chính,...)

--   -- 🗂️ Danh mục sản phẩm
--   category_id     UUID REFERENCES categories(id) ON DELETE SET NULL, -- Liên kết danh mục

--   -- 💰 Giá & Thuế
--   base_price      NUMERIC(12,2) NOT NULL DEFAULT 0,    -- Giá gốc chưa thuế
--   tax_rate        NUMERIC(5,2) DEFAULT 0,              -- Phần trăm thuế (%)
--   tax_amount      NUMERIC(12,2) GENERATED ALWAYS AS (base_price * tax_rate / 100) STORED,  
--   price_with_tax  NUMERIC(12,2) GENERATED ALWAYS AS (base_price + (base_price * tax_rate / 100)) STORED,

--   -- ⚙️ Cài đặt khác
--   is_tax_included BOOLEAN DEFAULT FALSE,        -- TRUE nếu base_price đã gồm thuế
--   popular         BOOLEAN DEFAULT FALSE,        -- Sản phẩm phổ biến
--   available       BOOLEAN DEFAULT TRUE,         -- Còn bán hay không
--   is_visible      BOOLEAN DEFAULT TRUE,         -- Ẩn/hiện trên giao diện

--   created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
-- CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
-- CREATE INDEX IF NOT EXISTS idx_products_visible    ON products(is_visible);


-- -- =========================================
-- -- 9) TỒN KHO
-- -- =========================================
-- CREATE TABLE IF NOT EXISTS inventory (
--   id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   branch_id       UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
--   product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

--   -- 📊 Quản lý tồn kho
--   quantity        INT DEFAULT 0,              -- Số lượng còn trong kho
--   reserved_qty    INT DEFAULT 0,              -- Số lượng đang giữ chỗ (chưa thanh toán)
--   min_stock       INT DEFAULT 10,             -- Ngưỡng cảnh báo khi sắp hết
--   last_restock_at TIMESTAMP WITH TIME ZONE,   -- Lần nhập hàng gần nhất

--   -- 📅 Giới hạn bán hàng theo ngày
--   daily_limit     INT DEFAULT NULL,           -- Số lượng bán tối đa trong 1 ngày
--   daily_sold      INT DEFAULT 0,              -- Đã bán hôm nay

--   -- ⚙️ Trạng thái
--   is_visible      BOOLEAN DEFAULT TRUE,       -- Ẩn sản phẩm khi hết hàng
--   is_active       BOOLEAN DEFAULT TRUE,       -- Đang quản lý tồn kho hay không

--   updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),

--   CONSTRAINT uq_inventory_branch_product UNIQUE (branch_id, product_id)
-- );

-- CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
-- CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory(is_active);

-- =====================================================================
-- PRODUCT-SERVICE DDL (PostgreSQL) — WITH TAX SUPPORT
-- =====================================================================

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
-- 4) CATEGORIES
-- =====================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS branch_product_option_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  product_id UUID NOT NULL,
  option_item_id UUID NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  price_delta_override NUMERIC(12,2),
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_id, product_id, option_item_id)
);
CREATE INDEX IF NOT EXISTS idx_bpoi_branch_product ON branch_product_option_items(branch_id, product_id, is_available, is_visible);

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
SELECT id, DATE '2025-01-29', DATE '2025-01-29', DATE '2025-08-02',
       'Tết Nguyên Đán (Âm lịch: 29/01–08/02/2025)', TRUE FROM cal;
