-- =========================================
-- BẬT EXTENSION UUID
-- =========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- 1) NHÀ HÀNG / THƯƠNG HIỆU
-- =========================================
CREATE TABLE IF NOT EXISTS restaurants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID NOT NULL, 
  name                 VARCHAR(150) NOT NULL,
  description          TEXT,
  about                TEXT,
  cuisine              VARCHAR(100),                 -- loại ẩm thực chính
  phone                VARCHAR(50),                  -- hotline/CSKH
  email                VARCHAR(150),                 -- email CSKH
  logo                 TEXT[],
  images               TEXT[],                       -- ảnh thương hiệu
  is_active            BOOLEAN DEFAULT TRUE,         -- thương hiệu còn hoạt động?
  avg_branch_rating    NUMERIC(3,2) NOT NULL DEFAULT 0,  -- điểm TB của toàn bộ chi nhánh
  total_branch_ratings INT NOT NULL DEFAULT 0,          -- số chi nhánh có rating > 0
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT now()
);

<<<<<<< HEAD
CREATE INDEX IF NOT EXISTS idx_restaurants_name     ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine  ON restaurants(cuisine);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner    ON restaurants(owner_id);

-- =========================================
-- 2) CHI NHÁNH CỦA THƯƠNG HIỆU
-- =========================================
CREATE TABLE IF NOT EXISTS restaurant_branches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_number  INT NOT NULL,                 -- mã chi nhánh nội bộ
  name           VARCHAR(150),                 -- tên hiển thị chi nhánh
  branch_phone   VARCHAR(50),
  branch_email   VARCHAR(150),
  rating         NUMERIC(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  images         TEXT[],                       -- hình ảnh riêng của chi nhánh
  street         VARCHAR(200) NOT NULL,
  ward           VARCHAR(100),
  district       VARCHAR(100),
  city           VARCHAR(100),
  latitude       NUMERIC(9,6),
  longitude      NUMERIC(9,6),
  is_primary     BOOLEAN DEFAULT FALSE,
  is_open        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_branch_per_restaurant UNIQUE (restaurant_id, branch_number)
);

CREATE INDEX IF NOT EXISTS idx_branches_restaurant   ON restaurant_branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_branches_city         ON restaurant_branches(city, district);
CREATE INDEX IF NOT EXISTS idx_branches_rating       ON restaurant_branches(rating DESC);
CREATE INDEX IF NOT EXISTS idx_branches_is_primary   ON restaurant_branches(restaurant_id, is_primary);

-- ============================================================
-- 3) GIỜ MỞ CỬA THEO NGÀY TRONG TUẦN
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_opening_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time   TIME,
  close_time  TIME,
  is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
  overnight   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_hours UNIQUE (branch_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_hours_branch ON branch_opening_hours(branch_id, day_of_week);

-- ============================================================
-- 4) GIỜ MỞ CỬA ĐẶC BIỆT (NGÀY LỄ / SỰ KIỆN)
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_special_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  on_date     DATE NOT NULL,
  open_time   TIME,
  close_time  TIME,
  is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
  overnight   BOOLEAN NOT NULL DEFAULT FALSE,
  note        VARCHAR(200),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_special UNIQUE (branch_id, on_date)
);

CREATE INDEX IF NOT EXISTS idx_special_hours_branch_date ON branch_special_hours(branch_id, on_date);

-- ============================================================
-- 5) ĐÁNH GIÁ CHI NHÁNH (branch_rating)
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_rating (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liên kết đến chi nhánh (branch)
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,

  -- Liên kết đến người dùng (từ user-service)
  user_id UUID NOT NULL,

  -- Liên kết đến đơn hàng (từ order-service)
  order_id UUID NOT NULL,

  -- Thông tin đánh giá
  rating_value INT CHECK (rating_value BETWEEN 1 AND 5),
  comment TEXT,
  image_url TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT uq_branch_rating UNIQUE (branch_id, user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_rating_branch  ON branch_rating(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_rating_user    ON branch_rating(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_rating_order   ON branch_rating(order_id);

-- ============================================================
-- 6) BẢNG TRUNG BÌNH RATING CHI NHÁNH (branch_rating_avg)
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_rating_avg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL UNIQUE REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_ratings INT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =========================================
-- 7) SẢN PHẨM
-- =========================================
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  images        TEXT[],
  category      VARCHAR(100),
  type          VARCHAR(50),
  base_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  popular       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);

-- =========================================
-- 8) TỒN KHO
-- =========================================

CREATE TABLE IF NOT EXISTS inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity      INT DEFAULT 0,
  sold_quantity INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_inventory_branch_product UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
