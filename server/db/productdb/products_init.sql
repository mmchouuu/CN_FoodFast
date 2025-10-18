CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- 1) THƯƠNG HIỆU / NHÀ HÀNG
-- =========================================
CREATE TABLE IF NOT EXISTS restaurants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID NOT NULL, -- lưu id chủ sở hữu, được quản lý ở user-service
  name                 VARCHAR(150) NOT NULL,
  description          TEXT,
  cuisine              VARCHAR(100),
  phone                VARCHAR(50),
  email                VARCHAR(150),
  images               TEXT[],
  is_active            BOOLEAN DEFAULT TRUE,
  avg_branch_rating    NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_branch_ratings INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_name    ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner   ON restaurants(owner_id);

-- =========================================
-- 2) CHI NHÁNH
-- =========================================
CREATE TABLE IF NOT EXISTS restaurant_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_number INT NOT NULL,
  name          VARCHAR(150),
  brand_phone   VARCHAR(50),
  brand_email   VARCHAR(150),
  rating        NUMERIC(3,2) DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  images        TEXT[],
  street        VARCHAR(200) NOT NULL,
  ward          VARCHAR(100),
  district      VARCHAR(100),
  city          VARCHAR(100),
  latitude      NUMERIC(9,6),
  longitude     NUMERIC(9,6),
  is_primary    BOOLEAN DEFAULT FALSE,
  is_open       BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_branch_per_restaurant UNIQUE (restaurant_id, branch_number)
);

CREATE INDEX IF NOT EXISTS idx_branches_restaurant ON restaurant_branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_branches_city       ON restaurant_branches(city, district);
CREATE INDEX IF NOT EXISTS idx_branches_rating     ON restaurant_branches(rating DESC);
CREATE INDEX IF NOT EXISTS idx_branches_primary    ON restaurant_branches(restaurant_id, is_primary);

-- =========================================
-- 3) GIỜ HOẠT ĐỘNG THƯỜNG
-- =========================================
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
  CONSTRAINT uq_branch_hours UNIQUE (branch_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_hours_branch ON branch_opening_hours(branch_id, day_of_week);

-- =========================================
-- 4) GIỜ HOẠT ĐỘNG ĐẶC BIỆT
-- =========================================
CREATE TABLE IF NOT EXISTS branch_special_hours (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  on_date    DATE NOT NULL,
  open_time  TIME,
  close_time TIME,
  is_closed  BOOLEAN NOT NULL DEFAULT FALSE,
  overnight  BOOLEAN NOT NULL DEFAULT FALSE,
  note       VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_branch_special UNIQUE (branch_id, on_date)
);

CREATE INDEX IF NOT EXISTS idx_special_hours_branch ON branch_special_hours(branch_id, on_date);

-- =========================================
-- 5) ĐÁNH GIÁ CHI NHÁNH
-- =========================================
CREATE TABLE IF NOT EXISTS branch_rating (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  order_id     UUID NOT NULL,
  rating_value INT CHECK (rating_value BETWEEN 1 AND 5),
  comment      TEXT,
  image_url    TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_branch_rating UNIQUE (branch_id, user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_rating_branch ON branch_rating(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_rating_user   ON branch_rating(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_rating_order  ON branch_rating(order_id);

-- =========================================
-- 6) THỐNG KÊ ĐIỂM CHI NHÁNH
-- =========================================
CREATE TABLE IF NOT EXISTS branch_rating_avg (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL UNIQUE REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  avg_rating    NUMERIC(3,2) DEFAULT 0,
  total_ratings INT DEFAULT 0,
  last_updated  TIMESTAMP WITH TIME ZONE DEFAULT now()
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
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_inventory_branch_product UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
