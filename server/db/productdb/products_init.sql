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
-- 7) DANH MỤC SẢN PHẨM
-- =========================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,      -- Tên danh mục (VD: Lẩu, Đồ uống, Tráng miệng)
  description TEXT,                       -- Mô tả chi tiết danh mục
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =========================================
-- 8) SẢN PHẨM
-- =========================================
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  -- 🥘 Thông tin sản phẩm
  title           VARCHAR(200) NOT NULL,         -- Tên món ăn
  description     TEXT,                          -- Mô tả chi tiết
  images          TEXT[],                        -- Ảnh sản phẩm
  type            VARCHAR(50),                   -- Loại (combo, topping, món chính,...)

  -- 🗂️ Danh mục sản phẩm
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL, -- Liên kết danh mục

  -- 💰 Giá & Thuế
  base_price      NUMERIC(12,2) NOT NULL DEFAULT 0,    -- Giá gốc chưa thuế
  tax_rate        NUMERIC(5,2) DEFAULT 0,              -- Phần trăm thuế (%)
  tax_amount      NUMERIC(12,2) GENERATED ALWAYS AS (base_price * tax_rate / 100) STORED,  
  price_with_tax  NUMERIC(12,2) GENERATED ALWAYS AS (base_price + (base_price * tax_rate / 100)) STORED,

  -- ⚙️ Cài đặt khác
  is_tax_included BOOLEAN DEFAULT FALSE,        -- TRUE nếu base_price đã gồm thuế
  popular         BOOLEAN DEFAULT FALSE,        -- Sản phẩm phổ biến
  available       BOOLEAN DEFAULT TRUE,         -- Còn bán hay không
  is_visible      BOOLEAN DEFAULT TRUE,         -- Ẩn/hiện trên giao diện

  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_visible    ON products(is_visible);


-- =========================================
-- 9) TỒN KHO
-- =========================================
CREATE TABLE IF NOT EXISTS inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- 📊 Quản lý tồn kho
  quantity        INT DEFAULT 0,              -- Số lượng còn trong kho
  reserved_qty    INT DEFAULT 0,              -- Số lượng đang giữ chỗ (chưa thanh toán)
  min_stock       INT DEFAULT 10,             -- Ngưỡng cảnh báo khi sắp hết
  last_restock_at TIMESTAMP WITH TIME ZONE,   -- Lần nhập hàng gần nhất

  -- 📅 Giới hạn bán hàng theo ngày
  daily_limit     INT DEFAULT NULL,           -- Số lượng bán tối đa trong 1 ngày
  daily_sold      INT DEFAULT 0,              -- Đã bán hôm nay

  -- ⚙️ Trạng thái
  is_visible      BOOLEAN DEFAULT TRUE,       -- Ẩn sản phẩm khi hết hàng
  is_active       BOOLEAN DEFAULT TRUE,       -- Đang quản lý tồn kho hay không

  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT uq_inventory_branch_product UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory(is_active);

-- Seed default restaurant, branch, categories, products, and inventory
DO $$
DECLARE
  v_owner_id UUID := 'd799adbe-6c5b-4b51-9832-9d364e9b9581';
  v_restaurant_id UUID := 'b8e2d454-71e9-4e9f-a01b-a6274957332e';
  v_branch_id UUID := 'a5ab66d4-8d2a-4d38-bd5b-1a27c0d9f2fe';
  v_main_category_id UUID := 'c9a5d2aa-1f42-4b5a-980d-0af0baf0a001';
  v_drink_category_id UUID := 'f1b5a320-7fe0-4e3b-9c75-657668218d5b';
  v_pho_product_id UUID := '7540a4d0-2622-4b4f-9325-f59e433d0b82';
  v_iced_coffee_product_id UUID := 'aab05299-4058-4c3f-bd52-e03f5bbf4e5e';
  v_branch_rating_avg_id UUID := 'c3d34d04-a03a-4e2f-8b4c-3d182d4fe77b';
  v_busan_restaurant_id UUID;
  v_busan_branch_id UUID;
  v_busan_rating_avg_id UUID;
  v_busan_tteokbokki_product_id UUID;
  v_busan_bulgogi_product_id UUID;
  v_busan_citron_product_id UUID;
  v_sasin_restaurant_id UUID;
  v_sasin_branch_id UUID;
  v_sasin_rating_avg_id UUID;
  v_sasin_seafood_noodle_product_id UUID;
  v_sasin_beef_hotpot_product_id UUID;
  v_sasin_cheese_tteokbokki_product_id UUID;
  v_hanuri_restaurant_id UUID;
  v_hanuri_branch_id UUID;
  v_hanuri_rating_avg_id UUID;
  v_hanuri_bibimbap_product_id UUID;
  v_hanuri_gimbap_product_id UUID;
  v_hanuri_yuja_ade_product_id UUID;
  v_kfc_restaurant_id UUID;
  v_kfc_branch_id UUID;
  v_kfc_rating_avg_id UUID;
  v_kfc_original_bucket_product_id UUID;
  v_kfc_zinger_combo_product_id UUID;
  v_kfc_popcorn_product_id UUID;
  v_lotte_restaurant_id UUID;
  v_lotte_branch_id UUID;
  v_lotte_rating_avg_id UUID;
  v_lotte_shrimp_burger_product_id UUID;
  v_lotte_cheese_stick_product_id UUID;
  v_lotte_peach_tea_product_id UUID;
  v_jollibee_restaurant_id UUID;
  v_jollibee_branch_id UUID;
  v_jollibee_rating_avg_id UUID;
  v_jollibee_chickenjoy_product_id UUID;
  v_jollibee_spaghetti_product_id UUID;
  v_jollibee_pineapple_product_id UUID;
  v_category_korean_comforts UUID;
  v_category_korean_refreshments UUID;
  v_category_spicy_noodle_pots UUID;
  v_category_street_snacks UUID;
  v_category_fast_food_classics UUID;
  v_category_chicken_buckets UUID;
  v_category_signature_burgers UUID;
  v_category_value_drinks UUID;
  day_idx INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = v_restaurant_id) THEN
    INSERT INTO restaurants (
      id,
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings
    )
    VALUES (
      v_restaurant_id,
      v_owner_id,
      'Taste of Saigon',
      'Authentic Vietnamese cuisine crafted with local ingredients.',
      'Family-owned brand serving traditional dishes with a contemporary twist.',
      'Vietnamese',
      '028-1234-5678',
      'contact@tasteofsaigon.local',
      ARRAY['https://cdn.sample.local/taste-of-saigon/logo.png']::text[],
      ARRAY[
        'https://cdn.sample.local/taste-of-saigon/dining-room.png',
        'https://cdn.sample.local/taste-of-saigon/signature-dishes.png'
      ]::text[],
      TRUE,
      4.80,
      25
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM restaurant_branches WHERE id = v_branch_id) THEN
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
    VALUES (
      v_branch_id,
      v_restaurant_id,
      1,
      'Taste of Saigon - District 1',
      '028-7654-3210',
      'district1@tasteofsaigon.local',
      4.90,
      ARRAY['https://cdn.sample.local/taste-of-saigon/branch-d1.png']::text[],
      '123 Nguyen Hue',
      'Ben Nghe',
      'District 1',
      'Ho Chi Minh City',
      10.775843,
      106.700806,
      TRUE,
      TRUE
    );
  END IF;

  FOR day_idx IN 0..6 LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM branch_opening_hours
      WHERE branch_id = v_branch_id AND day_of_week = day_idx
    ) THEN
      INSERT INTO branch_opening_hours (
        branch_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        overnight
      )
      VALUES (
        v_branch_id,
        day_idx,
        TIME '08:00',
        TIME '22:00',
        FALSE,
        FALSE
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM branch_rating_avg WHERE branch_id = v_branch_id) THEN
    INSERT INTO branch_rating_avg (
      id,
      branch_id,
      avg_rating,
      total_ratings
    )
    VALUES (
      v_branch_rating_avg_id,
      v_branch_id,
      4.85,
      25
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_main_category_id) THEN
    INSERT INTO categories (id, name, description)
    VALUES (
      v_main_category_id,
      'Main Dishes',
      'Signature Vietnamese entrees prepared daily.'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_drink_category_id) THEN
    INSERT INTO categories (id, name, description)
    VALUES (
      v_drink_category_id,
      'Beverages',
      'House-made drinks and local favorites.'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE id = v_pho_product_id) THEN
    INSERT INTO products (
      id,
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_pho_product_id,
      v_restaurant_id,
      'Pho Bo Dac Biet',
      'Slow-cooked beef broth with tenderloin, brisket, and fresh herbs.',
      ARRAY['https://cdn.sample.local/taste-of-saigon/pho-bo.png']::text[],
      'main',
      v_main_category_id,
      65000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE id = v_iced_coffee_product_id) THEN
    INSERT INTO products (
      id,
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_iced_coffee_product_id,
      v_restaurant_id,
      'Ca Phe Sua Da',
      'Robust Vietnamese coffee with condensed milk served over ice.',
      ARRAY['https://cdn.sample.local/taste-of-saigon/iced-coffee.png']::text[],
      'drink',
      v_drink_category_id,
      35000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM inventory
    WHERE branch_id = v_branch_id AND product_id = v_pho_product_id
  ) THEN
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_branch_id,
      v_pho_product_id,
      150,
      10,
      30,
      200,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM inventory
    WHERE branch_id = v_branch_id AND product_id = v_iced_coffee_product_id
  ) THEN
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_branch_id,
      v_iced_coffee_product_id,
      300,
      0,
      50,
      NULL,
      0,
      TRUE,
      TRUE
    );
  END IF;
  -- Ensure shared menu categories exist for the newly seeded chains
  SELECT id INTO v_category_korean_comforts FROM categories WHERE name = 'Korean Comforts';
  IF v_category_korean_comforts IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Korean Comforts',
      'Street-style Korean comfort dishes including rice bowls and stews.'
    )
    RETURNING id INTO v_category_korean_comforts;
  END IF;

  SELECT id INTO v_category_korean_refreshments FROM categories WHERE name = 'Korean Refreshments';
  IF v_category_korean_refreshments IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Korean Refreshments',
      'Korean-inspired specialty drinks and teas.'
    )
    RETURNING id INTO v_category_korean_refreshments;
  END IF;

  SELECT id INTO v_category_spicy_noodle_pots FROM categories WHERE name = 'Spicy Noodle Pots';
  IF v_category_spicy_noodle_pots IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Spicy Noodle Pots',
      'Signature spicy hotpot noodles and broth-based dishes.'
    )
    RETURNING id INTO v_category_spicy_noodle_pots;
  END IF;

  SELECT id INTO v_category_street_snacks FROM categories WHERE name = 'Street Snacks';
  IF v_category_street_snacks IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Street Snacks',
      'Quick bites, kimbap, and shareable finger food.'
    )
    RETURNING id INTO v_category_street_snacks;
  END IF;

  SELECT id INTO v_category_fast_food_classics FROM categories WHERE name = 'Fast Food Classics';
  IF v_category_fast_food_classics IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Fast Food Classics',
      'Burgers, fried chicken, and fan-favourite comfort meals.'
    )
    RETURNING id INTO v_category_fast_food_classics;
  END IF;

  SELECT id INTO v_category_chicken_buckets FROM categories WHERE name = 'Chicken Buckets';
  IF v_category_chicken_buckets IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Chicken Buckets',
      'Family-style fried chicken buckets and combos.'
    )
    RETURNING id INTO v_category_chicken_buckets;
  END IF;

  SELECT id INTO v_category_signature_burgers FROM categories WHERE name = 'Signature Burgers';
  IF v_category_signature_burgers IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Signature Burgers',
      'House specialty burgers and sandwich creations.'
    )
    RETURNING id INTO v_category_signature_burgers;
  END IF;

  SELECT id INTO v_category_value_drinks FROM categories WHERE name = 'Value Drinks';
  IF v_category_value_drinks IS NULL THEN
    INSERT INTO categories (name, description)
    VALUES (
      'Value Drinks',
      'Iced teas, juices, and value-friendly beverages.'
    )
    RETURNING id INTO v_category_value_drinks;
  END IF;

  -- Busan Korean Street Food
  SELECT id INTO v_busan_restaurant_id FROM restaurants WHERE name = 'Busan Korean Street Food';
  IF v_busan_restaurant_id IS NULL THEN
    INSERT INTO restaurants (
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings
    )
    VALUES (
      gen_random_uuid(),
      'Busan Korean Street Food',
      'Casual Korean eatery serving street food classics from Busan.',
      'Busan-inspired kitchen offering tteokbokki, fish cakes, and homestyle rice bowls.',
      'Korean',
      '028-5678-1122',
      'hello@busanstreet.vn',
      ARRAY['https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&w=400&q=60']::text[],
      ARRAY[
        'https://images.unsplash.com/photo-1604908177070-0e7f3a4e1dca?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      TRUE,
      4.65,
      287
    )
    RETURNING id INTO v_busan_restaurant_id;
  ELSE
    UPDATE restaurants
    SET
      description = 'Casual Korean eatery serving street food classics from Busan.',
      about = 'Busan-inspired kitchen offering tteokbokki, fish cakes, and homestyle rice bowls.',
      cuisine = 'Korean',
      phone = '028-5678-1122',
      email = 'hello@busanstreet.vn',
      logo = ARRAY['https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&w=400&q=60']::text[],
      images = ARRAY[
        'https://images.unsplash.com/photo-1604908177070-0e7f3a4e1dca?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      avg_branch_rating = 4.65,
      total_branch_ratings = 287,
      is_active = TRUE,
      updated_at = now()
    WHERE id = v_busan_restaurant_id;
  END IF;

  SELECT id INTO v_busan_branch_id
  FROM restaurant_branches
  WHERE restaurant_id = v_busan_restaurant_id AND branch_number = 1;

  IF v_busan_branch_id IS NULL THEN
    INSERT INTO restaurant_branches (
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
    VALUES (
      v_busan_restaurant_id,
      1,
      'Busan Korean Street Food - District 1',
      '028-5678-1123',
      'district1@busanstreet.vn',
      4.70,
      ARRAY['https://images.unsplash.com/photo-1533777419517-3e4017e2e15c?auto=format&fit=crop&w=1200&q=80']::text[],
      '45 Le Loi',
      'Ben Nghe',
      'District 1',
      'Ho Chi Minh City',
      10.772300,
      106.703000,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_busan_branch_id;
  ELSE
    UPDATE restaurant_branches
    SET
      name = 'Busan Korean Street Food - District 1',
      branch_phone = '028-5678-1123',
      branch_email = 'district1@busanstreet.vn',
      rating = 4.70,
      images = ARRAY['https://images.unsplash.com/photo-1533777419517-3e4017e2e15c?auto=format&fit=crop&w=1200&q=80']::text[],
      street = '45 Le Loi',
      ward = 'Ben Nghe',
      district = 'District 1',
      city = 'Ho Chi Minh City',
      latitude = 10.772300,
      longitude = 106.703000,
      is_primary = TRUE,
      is_open = TRUE,
      updated_at = now()
    WHERE id = v_busan_branch_id;
  END IF;

  FOR day_idx IN 0..6 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_opening_hours
      WHERE branch_id = v_busan_branch_id AND day_of_week = day_idx
    ) THEN
      INSERT INTO branch_opening_hours (
        branch_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        overnight
      )
      VALUES (
        v_busan_branch_id,
        day_idx,
        TIME '10:00',
        TIME '22:00',
        FALSE,
        FALSE
      );
    ELSE
      UPDATE branch_opening_hours
      SET
        open_time = TIME '10:00',
        close_time = TIME '22:00',
        is_closed = FALSE,
        overnight = FALSE,
        updated_at = now()
      WHERE branch_id = v_busan_branch_id AND day_of_week = day_idx;
    END IF;
  END LOOP;

  SELECT id INTO v_busan_rating_avg_id FROM branch_rating_avg WHERE branch_id = v_busan_branch_id;
  IF v_busan_rating_avg_id IS NULL THEN
    INSERT INTO branch_rating_avg (branch_id, avg_rating, total_ratings)
    VALUES (v_busan_branch_id, 4.68, 287)
    RETURNING id INTO v_busan_rating_avg_id;
  ELSE
    UPDATE branch_rating_avg
    SET
      avg_rating = 4.68,
      total_ratings = 287,
      last_updated = now()
    WHERE branch_id = v_busan_branch_id;
  END IF;

  SELECT id INTO v_busan_tteokbokki_product_id
  FROM products
  WHERE restaurant_id = v_busan_restaurant_id AND title = 'Busan Tteokbokki Supreme';

  IF v_busan_tteokbokki_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_busan_restaurant_id,
      'Busan Tteokbokki Supreme',
      'Chewy rice cakes simmered in gochujang sauce with fish cakes and mozzarella.',
      ARRAY['https://images.unsplash.com/photo-1612870533462-1a0b1fb26a40?auto=format&fit=crop&w=1200&q=80']::text[],
      'Hotpot',
      v_category_korean_comforts,
      89000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_busan_tteokbokki_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Chewy rice cakes simmered in gochujang sauce with fish cakes and mozzarella.',
      images = ARRAY['https://images.unsplash.com/photo-1612870533462-1a0b1fb26a40?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Hotpot',
      category_id = v_category_korean_comforts,
      base_price = 89000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_busan_tteokbokki_product_id;
  END IF;

  SELECT id INTO v_busan_bulgogi_product_id
  FROM products
  WHERE restaurant_id = v_busan_restaurant_id AND title = 'Busan Bulgogi Rice Bowl';

  IF v_busan_bulgogi_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_busan_restaurant_id,
      'Busan Bulgogi Rice Bowl',
      'Marinated beef bulgogi served with pickled radish, kimchi, and steamed rice.',
      ARRAY['https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80']::text[],
      'Rice',
      v_category_korean_comforts,
      99000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_busan_bulgogi_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Marinated beef bulgogi served with pickled radish, kimchi, and steamed rice.',
      images = ARRAY['https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Rice',
      category_id = v_category_korean_comforts,
      base_price = 99000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_busan_bulgogi_product_id;
  END IF;

  SELECT id INTO v_busan_citron_product_id
  FROM products
  WHERE restaurant_id = v_busan_restaurant_id AND title = 'Honey Citron Tea';

  IF v_busan_citron_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_busan_restaurant_id,
      'Honey Citron Tea',
      'Warm honey-yuja tea with orange peel and a hint of ginger.',
      ARRAY['https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80']::text[],
      'Drink',
      v_category_korean_refreshments,
      45000,
      5,
      FALSE,
      FALSE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_busan_citron_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Warm honey-yuja tea with orange peel and a hint of ginger.',
      images = ARRAY['https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Drink',
      category_id = v_category_korean_refreshments,
      base_price = 45000,
      tax_rate = 5,
      is_tax_included = FALSE,
      popular = FALSE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_busan_citron_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_busan_branch_id AND product_id = v_busan_tteokbokki_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 80,
      reserved_qty = 4,
      min_stock = 20,
      daily_limit = 150,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_busan_branch_id AND product_id = v_busan_tteokbokki_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_busan_branch_id,
      v_busan_tteokbokki_product_id,
      80,
      4,
      20,
      150,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_busan_branch_id AND product_id = v_busan_bulgogi_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 100,
      reserved_qty = 6,
      min_stock = 25,
      daily_limit = 160,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_busan_branch_id AND product_id = v_busan_bulgogi_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_busan_branch_id,
      v_busan_bulgogi_product_id,
      100,
      6,
      25,
      160,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_busan_branch_id AND product_id = v_busan_citron_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 200,
      reserved_qty = 12,
      min_stock = 40,
      daily_limit = NULL,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_busan_branch_id AND product_id = v_busan_citron_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_busan_branch_id,
      v_busan_citron_product_id,
      200,
      12,
      40,
      NULL,
      0,
      TRUE,
      TRUE
    );
  END IF;

  -- Mi Cay Sasin
  SELECT id INTO v_sasin_restaurant_id FROM restaurants WHERE name = 'Mi Cay Sasin';
  IF v_sasin_restaurant_id IS NULL THEN
    INSERT INTO restaurants (
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings
    )
    VALUES (
      gen_random_uuid(),
      'Mi Cay Sasin',
      'Legendary 7-level spicy noodle hotpot chain from Korea.',
      'Famous for intensely spiced noodle pots, seafood toppings, and late-night cravings.',
      'Korean Fusion',
      '028-6789-4455',
      'hotline@micaysasin.vn',
      ARRAY['https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=400&q=60']::text[],
      ARRAY[
        'https://images.unsplash.com/photo-1546069901-5aea2c8a66c7?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      TRUE,
      4.55,
      412
    )
    RETURNING id INTO v_sasin_restaurant_id;
  ELSE
    UPDATE restaurants
    SET
      description = 'Legendary 7-level spicy noodle hotpot chain from Korea.',
      about = 'Famous for intensely spiced noodle pots, seafood toppings, and late-night cravings.',
      cuisine = 'Korean Fusion',
      phone = '028-6789-4455',
      email = 'hotline@micaysasin.vn',
      logo = ARRAY['https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=400&q=60']::text[],
      images = ARRAY[
        'https://images.unsplash.com/photo-1546069901-5aea2c8a66c7?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      avg_branch_rating = 4.55,
      total_branch_ratings = 412,
      is_active = TRUE,
      updated_at = now()
    WHERE id = v_sasin_restaurant_id;
  END IF;

  SELECT id INTO v_sasin_branch_id
  FROM restaurant_branches
  WHERE restaurant_id = v_sasin_restaurant_id AND branch_number = 1;

  IF v_sasin_branch_id IS NULL THEN
    INSERT INTO restaurant_branches (
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
    VALUES (
      v_sasin_restaurant_id,
      1,
      'Mi Cay Sasin - District 10',
      '028-6789-4456',
      'district10@micaysasin.vn',
      4.60,
      ARRAY['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80']::text[],
      '120 Su Van Hanh',
      'Ward 9',
      'District 10',
      'Ho Chi Minh City',
      10.776000,
      106.667400,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_sasin_branch_id;
  ELSE
    UPDATE restaurant_branches
    SET
      name = 'Mi Cay Sasin - District 10',
      branch_phone = '028-6789-4456',
      branch_email = 'district10@micaysasin.vn',
      rating = 4.60,
      images = ARRAY['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80']::text[],
      street = '120 Su Van Hanh',
      ward = 'Ward 9',
      district = 'District 10',
      city = 'Ho Chi Minh City',
      latitude = 10.776000,
      longitude = 106.667400,
      is_primary = TRUE,
      is_open = TRUE,
      updated_at = now()
    WHERE id = v_sasin_branch_id;
  END IF;

  FOR day_idx IN 0..6 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_opening_hours
      WHERE branch_id = v_sasin_branch_id AND day_of_week = day_idx
    ) THEN
      INSERT INTO branch_opening_hours (
        branch_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        overnight
      )
      VALUES (
        v_sasin_branch_id,
        day_idx,
        TIME '09:00',
        TIME '23:00',
        FALSE,
        FALSE
      );
    ELSE
      UPDATE branch_opening_hours
      SET
        open_time = TIME '09:00',
        close_time = TIME '23:00',
        is_closed = FALSE,
        overnight = FALSE,
        updated_at = now()
      WHERE branch_id = v_sasin_branch_id AND day_of_week = day_idx;
    END IF;
  END LOOP;

  SELECT id INTO v_sasin_rating_avg_id FROM branch_rating_avg WHERE branch_id = v_sasin_branch_id;
  IF v_sasin_rating_avg_id IS NULL THEN
    INSERT INTO branch_rating_avg (branch_id, avg_rating, total_ratings)
    VALUES (v_sasin_branch_id, 4.58, 412)
    RETURNING id INTO v_sasin_rating_avg_id;
  ELSE
    UPDATE branch_rating_avg
    SET
      avg_rating = 4.58,
      total_ratings = 412,
      last_updated = now()
    WHERE branch_id = v_sasin_branch_id;
  END IF;

  SELECT id INTO v_sasin_seafood_noodle_product_id
  FROM products
  WHERE restaurant_id = v_sasin_restaurant_id AND title = 'Level 5 Seafood Noodle Pot';

  IF v_sasin_seafood_noodle_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_sasin_restaurant_id,
      'Level 5 Seafood Noodle Pot',
      'Signature spicy seafood broth with mussels, shrimp, and chewy noodles.',
      ARRAY['https://images.unsplash.com/photo-1512058564366-c9e3e0464b8f?auto=format&fit=crop&w=1200&q=80']::text[],
      'Hotpot',
      v_category_spicy_noodle_pots,
      99000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_sasin_seafood_noodle_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Signature spicy seafood broth with mussels, shrimp, and chewy noodles.',
      images = ARRAY['https://images.unsplash.com/photo-1512058564366-c9e3e0464b8f?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Hotpot',
      category_id = v_category_spicy_noodle_pots,
      base_price = 99000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_sasin_seafood_noodle_product_id;
  END IF;

  SELECT id INTO v_sasin_beef_hotpot_product_id
  FROM products
  WHERE restaurant_id = v_sasin_restaurant_id AND title = 'Premium Beef Hotpot';

  IF v_sasin_beef_hotpot_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_sasin_restaurant_id,
      'Premium Beef Hotpot',
      'Slow simmered beef bones with vegetables, tofu, and glass noodles.',
      ARRAY['https://images.unsplash.com/photo-1618196260154-5f06b9aff624?auto=format&fit=crop&w=1200&q=80']::text[],
      'Hotpot',
      v_category_spicy_noodle_pots,
      115000,
      8,
      FALSE,
      FALSE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_sasin_beef_hotpot_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Slow simmered beef bones with vegetables, tofu, and glass noodles.',
      images = ARRAY['https://images.unsplash.com/photo-1618196260154-5f06b9aff624?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Hotpot',
      category_id = v_category_spicy_noodle_pots,
      base_price = 115000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = FALSE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_sasin_beef_hotpot_product_id;
  END IF;

  SELECT id INTO v_sasin_cheese_tteokbokki_product_id
  FROM products
  WHERE restaurant_id = v_sasin_restaurant_id AND title = 'Cheese Tteokbokki Bites';

  IF v_sasin_cheese_tteokbokki_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_sasin_restaurant_id,
      'Cheese Tteokbokki Bites',
      'Crispy rice cakes coated in house spicy sauce and mozzarella cheese.',
      ARRAY['https://images.unsplash.com/photo-1601315483447-02008188c656?auto=format&fit=crop&w=1200&q=80']::text[],
      'Snack',
      v_category_street_snacks,
      79000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_sasin_cheese_tteokbokki_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Crispy rice cakes coated in house spicy sauce and mozzarella cheese.',
      images = ARRAY['https://images.unsplash.com/photo-1601315483447-02008188c656?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Snack',
      category_id = v_category_street_snacks,
      base_price = 79000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_sasin_cheese_tteokbokki_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_sasin_branch_id AND product_id = v_sasin_seafood_noodle_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 90,
      reserved_qty = 5,
      min_stock = 18,
      daily_limit = 140,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_sasin_branch_id AND product_id = v_sasin_seafood_noodle_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_sasin_branch_id,
      v_sasin_seafood_noodle_product_id,
      90,
      5,
      18,
      140,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_sasin_branch_id AND product_id = v_sasin_beef_hotpot_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 70,
      reserved_qty = 6,
      min_stock = 15,
      daily_limit = 120,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_sasin_branch_id AND product_id = v_sasin_beef_hotpot_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_sasin_branch_id,
      v_sasin_beef_hotpot_product_id,
      70,
      6,
      15,
      120,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_sasin_branch_id AND product_id = v_sasin_cheese_tteokbokki_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 110,
      reserved_qty = 8,
      min_stock = 25,
      daily_limit = 200,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_sasin_branch_id AND product_id = v_sasin_cheese_tteokbokki_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_sasin_branch_id,
      v_sasin_cheese_tteokbokki_product_id,
      110,
      8,
      25,
      200,
      0,
      TRUE,
      TRUE
    );
  END IF;

  -- Hanuri Korean Fast Food
  SELECT id INTO v_hanuri_restaurant_id FROM restaurants WHERE name = 'Hanuri Korean Fast Food';
  IF v_hanuri_restaurant_id IS NULL THEN
    INSERT INTO restaurants (
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings
    )
    VALUES (
      gen_random_uuid(),
      'Hanuri Korean Fast Food',
      'Casual counter-service Korean meals, ready in minutes.',
      'Popular student spot for bibimbap, gimbap rolls, and affordable combos.',
      'Korean',
      '028-3844-8899',
      'order@hanuri.vn',
      ARRAY['https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=60']::text[],
      ARRAY[
        'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1601315483447-02008188c656?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      TRUE,
      4.48,
      260
    )
    RETURNING id INTO v_hanuri_restaurant_id;
  ELSE
    UPDATE restaurants
    SET
      description = 'Casual counter-service Korean meals, ready in minutes.',
      about = 'Popular student spot for bibimbap, gimbap rolls, and affordable combos.',
      cuisine = 'Korean',
      phone = '028-3844-8899',
      email = 'order@hanuri.vn',
      logo = ARRAY['https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=60']::text[],
      images = ARRAY[
        'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1601315483447-02008188c656?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      avg_branch_rating = 4.48,
      total_branch_ratings = 260,
      is_active = TRUE,
      updated_at = now()
    WHERE id = v_hanuri_restaurant_id;
  END IF;

  SELECT id INTO v_hanuri_branch_id
  FROM restaurant_branches
  WHERE restaurant_id = v_hanuri_restaurant_id AND branch_number = 1;

  IF v_hanuri_branch_id IS NULL THEN
    INSERT INTO restaurant_branches (
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
    VALUES (
      v_hanuri_restaurant_id,
      1,
      'Hanuri Korean Fast Food - Nguyen Trai',
      '028-3844-8898',
      'nguyentrai@hanuri.vn',
      4.50,
      ARRAY['https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=1200&q=80']::text[],
      '284 Nguyen Trai',
      'Pham Ngu Lao',
      'District 1',
      'Ho Chi Minh City',
      10.768500,
      106.692500,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_hanuri_branch_id;
  ELSE
    UPDATE restaurant_branches
    SET
      name = 'Hanuri Korean Fast Food - Nguyen Trai',
      branch_phone = '028-3844-8898',
      branch_email = 'nguyentrai@hanuri.vn',
      rating = 4.50,
      images = ARRAY['https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=1200&q=80']::text[],
      street = '284 Nguyen Trai',
      ward = 'Pham Ngu Lao',
      district = 'District 1',
      city = 'Ho Chi Minh City',
      latitude = 10.768500,
      longitude = 106.692500,
      is_primary = TRUE,
      is_open = TRUE,
      updated_at = now()
    WHERE id = v_hanuri_branch_id;
  END IF;

  FOR day_idx IN 0..6 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_opening_hours
      WHERE branch_id = v_hanuri_branch_id AND day_of_week = day_idx
    ) THEN
      INSERT INTO branch_opening_hours (
        branch_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        overnight
      )
      VALUES (
        v_hanuri_branch_id,
        day_idx,
        TIME '10:00',
        TIME '21:30',
        FALSE,
        FALSE
      );
    ELSE
      UPDATE branch_opening_hours
      SET
        open_time = TIME '10:00',
        close_time = TIME '21:30',
        is_closed = FALSE,
        overnight = FALSE,
        updated_at = now()
      WHERE branch_id = v_hanuri_branch_id AND day_of_week = day_idx;
    END IF;
  END LOOP;

  SELECT id INTO v_hanuri_rating_avg_id FROM branch_rating_avg WHERE branch_id = v_hanuri_branch_id;
  IF v_hanuri_rating_avg_id IS NULL THEN
    INSERT INTO branch_rating_avg (branch_id, avg_rating, total_ratings)
    VALUES (v_hanuri_branch_id, 4.50, 260)
    RETURNING id INTO v_hanuri_rating_avg_id;
  ELSE
    UPDATE branch_rating_avg
    SET
      avg_rating = 4.50,
      total_ratings = 260,
      last_updated = now()
    WHERE branch_id = v_hanuri_branch_id;
  END IF;

  SELECT id INTO v_hanuri_bibimbap_product_id
  FROM products
  WHERE restaurant_id = v_hanuri_restaurant_id AND title = 'Beef Bibimbap Bowl';

  IF v_hanuri_bibimbap_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_hanuri_restaurant_id,
      'Beef Bibimbap Bowl',
      'Steamed rice topped with marinated beef, vegetables, and gochujang sauce.',
      ARRAY['https://images.unsplash.com/photo-1589307004399-70c2b4f71d3f?auto=format&fit=crop&w=1200&q=80']::text[],
      'Rice',
      v_category_korean_comforts,
      105000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_hanuri_bibimbap_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Steamed rice topped with marinated beef, vegetables, and gochujang sauce.',
      images = ARRAY['https://images.unsplash.com/photo-1589307004399-70c2b4f71d3f?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Rice',
      category_id = v_category_korean_comforts,
      base_price = 105000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_hanuri_bibimbap_product_id;
  END IF;

  SELECT id INTO v_hanuri_gimbap_product_id
  FROM products
  WHERE restaurant_id = v_hanuri_restaurant_id AND title = 'Classic Seaweed Gimbap';

  IF v_hanuri_gimbap_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_hanuri_restaurant_id,
      'Classic Seaweed Gimbap',
      'Hand-rolled gimbap filled with crab sticks, pickled radish, and omelette.',
      ARRAY['https://images.unsplash.com/photo-1601050690597-df92e3f3cd0b?auto=format&fit=crop&w=1200&q=80']::text[],
      'Roll',
      v_category_street_snacks,
      65000,
      8,
      FALSE,
      FALSE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_hanuri_gimbap_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Hand-rolled gimbap filled with crab sticks, pickled radish, and omelette.',
      images = ARRAY['https://images.unsplash.com/photo-1601050690597-df92e3f3cd0b?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Roll',
      category_id = v_category_street_snacks,
      base_price = 65000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = FALSE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_hanuri_gimbap_product_id;
  END IF;

  SELECT id INTO v_hanuri_yuja_ade_product_id
  FROM products
  WHERE restaurant_id = v_hanuri_restaurant_id AND title = 'Yuja Sparkling Ade';

  IF v_hanuri_yuja_ade_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_hanuri_restaurant_id,
      'Yuja Sparkling Ade',
      'Refreshing sparkling drink with yuja marmalade and fresh citrus slices.',
      ARRAY['https://images.unsplash.com/photo-1510626176961-4b37d0f0b56c?auto=format&fit=crop&w=1200&q=80']::text[],
      'Drink',
      v_category_korean_refreshments,
      49000,
      5,
      FALSE,
      FALSE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_hanuri_yuja_ade_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Refreshing sparkling drink with yuja marmalade and fresh citrus slices.',
      images = ARRAY['https://images.unsplash.com/photo-1510626176961-4b37d0f0b56c?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Drink',
      category_id = v_category_korean_refreshments,
      base_price = 49000,
      tax_rate = 5,
      is_tax_included = FALSE,
      popular = FALSE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_hanuri_yuja_ade_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_hanuri_branch_id AND product_id = v_hanuri_bibimbap_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 85,
      reserved_qty = 7,
      min_stock = 18,
      daily_limit = 150,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_hanuri_branch_id AND product_id = v_hanuri_bibimbap_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_hanuri_branch_id,
      v_hanuri_bibimbap_product_id,
      85,
      7,
      18,
      150,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_hanuri_branch_id AND product_id = v_hanuri_gimbap_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 120,
      reserved_qty = 10,
      min_stock = 30,
      daily_limit = 220,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_hanuri_branch_id AND product_id = v_hanuri_gimbap_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_hanuri_branch_id,
      v_hanuri_gimbap_product_id,
      120,
      10,
      30,
      220,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_hanuri_branch_id AND product_id = v_hanuri_yuja_ade_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 140,
      reserved_qty = 12,
      min_stock = 35,
      daily_limit = NULL,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_hanuri_branch_id AND product_id = v_hanuri_yuja_ade_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_hanuri_branch_id,
      v_hanuri_yuja_ade_product_id,
      140,
      12,
      35,
      NULL,
      0,
      TRUE,
      TRUE
    );
  END IF;

  -- KFC Vietnam
  SELECT id INTO v_kfc_restaurant_id FROM restaurants WHERE name = 'KFC Vietnam';
  IF v_kfc_restaurant_id IS NULL THEN
    INSERT INTO restaurants (
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings
    )
    VALUES (
      gen_random_uuid(),
      'KFC Vietnam',
      'World-famous fried chicken with local twists and seasonal specials.',
      'Serving the Colonel''s secret recipe with convenient combos and delivery.',
      'Fast Food',
      '1900-6886',
      'support@kfcvietnam.vn',
      ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/KFC_logo.svg/512px-KFC_logo.svg.png']::text[],
      ARRAY[
        'https://images.unsplash.com/photo-1589308078052-efe869cf56be?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      TRUE,
      4.35,
      980
    )
    RETURNING id INTO v_kfc_restaurant_id;
  ELSE
    UPDATE restaurants
    SET
      description = 'World-famous fried chicken with local twists and seasonal specials.',
      about = 'Serving the Colonel''s secret recipe with convenient combos and delivery.',
      cuisine = 'Fast Food',
      phone = '1900-6886',
      email = 'support@kfcvietnam.vn',
      logo = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/KFC_logo.svg/512px-KFC_logo.svg.png']::text[],
      images = ARRAY[
        'https://images.unsplash.com/photo-1589308078052-efe869cf56be?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      avg_branch_rating = 4.35,
      total_branch_ratings = 980,
      is_active = TRUE,
      updated_at = now()
    WHERE id = v_kfc_restaurant_id;
  END IF;

  SELECT id INTO v_kfc_branch_id
  FROM restaurant_branches
  WHERE restaurant_id = v_kfc_restaurant_id AND branch_number = 1;

  IF v_kfc_branch_id IS NULL THEN
    INSERT INTO restaurant_branches (
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
    VALUES (
      v_kfc_restaurant_id,
      1,
      'KFC Vietnam - Nguyen Thi Minh Khai',
      '028-3830-8888',
      'ntmk@kfcvietnam.vn',
      4.40,
      ARRAY['https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=1200&q=80']::text[],
      '202 Nguyen Thi Minh Khai',
      'Ward 6',
      'District 3',
      'Ho Chi Minh City',
      10.779900,
      106.683300,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_kfc_branch_id;
  ELSE
    UPDATE restaurant_branches
    SET
      name = 'KFC Vietnam - Nguyen Thi Minh Khai',
      branch_phone = '028-3830-8888',
      branch_email = 'ntmk@kfcvietnam.vn',
      rating = 4.40,
      images = ARRAY['https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=1200&q=80']::text[],
      street = '202 Nguyen Thi Minh Khai',
      ward = 'Ward 6',
      district = 'District 3',
      city = 'Ho Chi Minh City',
      latitude = 10.779900,
      longitude = 106.683300,
      is_primary = TRUE,
      is_open = TRUE,
      updated_at = now()
    WHERE id = v_kfc_branch_id;
  END IF;

  FOR day_idx IN 0..6 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_opening_hours
      WHERE branch_id = v_kfc_branch_id AND day_of_week = day_idx
    ) THEN
      INSERT INTO branch_opening_hours (
        branch_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        overnight
      )
      VALUES (
        v_kfc_branch_id,
        day_idx,
        TIME '09:00',
        TIME '23:00',
        FALSE,
        FALSE
      );
    ELSE
      UPDATE branch_opening_hours
      SET
        open_time = TIME '09:00',
        close_time = TIME '23:00',
        is_closed = FALSE,
        overnight = FALSE,
        updated_at = now()
      WHERE branch_id = v_kfc_branch_id AND day_of_week = day_idx;
    END IF;
  END LOOP;

  SELECT id INTO v_kfc_rating_avg_id FROM branch_rating_avg WHERE branch_id = v_kfc_branch_id;
  IF v_kfc_rating_avg_id IS NULL THEN
    INSERT INTO branch_rating_avg (branch_id, avg_rating, total_ratings)
    VALUES (v_kfc_branch_id, 4.40, 980)
    RETURNING id INTO v_kfc_rating_avg_id;
  ELSE
    UPDATE branch_rating_avg
    SET
      avg_rating = 4.40,
      total_ratings = 980,
      last_updated = now()
    WHERE branch_id = v_kfc_branch_id;
  END IF;

  SELECT id INTO v_kfc_original_bucket_product_id
  FROM products
  WHERE restaurant_id = v_kfc_restaurant_id AND title = 'Original Recipe 2pc Combo';

  IF v_kfc_original_bucket_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_kfc_restaurant_id,
      'Original Recipe 2pc Combo',
      'Two pieces of original recipe chicken with fries, salad, and a drink.',
      ARRAY['https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=1200&q=80']::text[],
      'Combo',
      v_category_chicken_buckets,
      105000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_kfc_original_bucket_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Two pieces of original recipe chicken with fries, salad, and a drink.',
      images = ARRAY['https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Combo',
      category_id = v_category_chicken_buckets,
      base_price = 105000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_kfc_original_bucket_product_id;
  END IF;

  SELECT id INTO v_kfc_zinger_combo_product_id
  FROM products
  WHERE restaurant_id = v_kfc_restaurant_id AND title = 'Zinger Burger Meal';

  IF v_kfc_zinger_combo_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_kfc_restaurant_id,
      'Zinger Burger Meal',
      'Crispy Zinger burger served with fries and a chilled drink.',
      ARRAY['https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1200&q=80']::text[],
      'Combo',
      v_category_signature_burgers,
      99000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_kfc_zinger_combo_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Crispy Zinger burger served with fries and a chilled drink.',
      images = ARRAY['https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Combo',
      category_id = v_category_signature_burgers,
      base_price = 99000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_kfc_zinger_combo_product_id;
  END IF;

  SELECT id INTO v_kfc_popcorn_product_id
  FROM products
  WHERE restaurant_id = v_kfc_restaurant_id AND title = 'Chicken Pop Bites';

  IF v_kfc_popcorn_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_kfc_restaurant_id,
      'Chicken Pop Bites',
      'Golden bite-sized chicken coated in the Colonel''s seasoning.',
      ARRAY['https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=1200&q=80']::text[],
      'Snack',
      v_category_fast_food_classics,
      65000,
      8,
      FALSE,
      FALSE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_kfc_popcorn_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Golden bite-sized chicken coated in the Colonel''s seasoning.',
      images = ARRAY['https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Snack',
      category_id = v_category_fast_food_classics,
      base_price = 65000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = FALSE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_kfc_popcorn_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_kfc_branch_id AND product_id = v_kfc_original_bucket_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 160,
      reserved_qty = 20,
      min_stock = 40,
      daily_limit = 260,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_kfc_branch_id AND product_id = v_kfc_original_bucket_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_kfc_branch_id,
      v_kfc_original_bucket_product_id,
      160,
      20,
      40,
      260,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_kfc_branch_id AND product_id = v_kfc_zinger_combo_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 130,
      reserved_qty = 18,
      min_stock = 30,
      daily_limit = 240,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_kfc_branch_id AND product_id = v_kfc_zinger_combo_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_kfc_branch_id,
      v_kfc_zinger_combo_product_id,
      130,
      18,
      30,
      240,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_kfc_branch_id AND product_id = v_kfc_popcorn_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 200,
      reserved_qty = 25,
      min_stock = 50,
      daily_limit = 320,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_kfc_branch_id AND product_id = v_kfc_popcorn_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_kfc_branch_id,
      v_kfc_popcorn_product_id,
      200,
      25,
      50,
      320,
      0,
      TRUE,
      TRUE
    );
  END IF;

  -- Lotteria Vietnam
  SELECT id INTO v_lotte_restaurant_id FROM restaurants WHERE name = 'Lotteria Vietnam';
  IF v_lotte_restaurant_id IS NULL THEN
    INSERT INTO restaurants (
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings
    )
    VALUES (
      gen_random_uuid(),
      'Lotteria Vietnam',
      'Korean fast food favourite with iconic shrimp burgers and desserts.',
      'Vibrant burger chain serving localised combos, sides, and sweet treats.',
      'Fast Food',
      '028-3823-6111',
      'hello@lotteria.vn',
      ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Lotteria_logo.svg/512px-Lotteria_logo.svg.png']::text[],
      ARRAY[
        'https://images.unsplash.com/photo-1542838708-32cfe85fd5ef?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      TRUE,
      4.12,
      650
    )
    RETURNING id INTO v_lotte_restaurant_id;
  ELSE
    UPDATE restaurants
    SET
      description = 'Korean fast food favourite with iconic shrimp burgers and desserts.',
      about = 'Vibrant burger chain serving localised combos, sides, and sweet treats.',
      cuisine = 'Fast Food',
      phone = '028-3823-6111',
      email = 'hello@lotteria.vn',
      logo = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Lotteria_logo.svg/512px-Lotteria_logo.svg.png']::text[],
      images = ARRAY[
        'https://images.unsplash.com/photo-1542838708-32cfe85fd5ef?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      avg_branch_rating = 4.12,
      total_branch_ratings = 650,
      is_active = TRUE,
      updated_at = now()
    WHERE id = v_lotte_restaurant_id;
  END IF;

  SELECT id INTO v_lotte_branch_id
  FROM restaurant_branches
  WHERE restaurant_id = v_lotte_restaurant_id AND branch_number = 1;

  IF v_lotte_branch_id IS NULL THEN
    INSERT INTO restaurant_branches (
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
    VALUES (
      v_lotte_restaurant_id,
      1,
      'Lotteria Vietnam - Vincom Dong Khoi',
      '028-3823-6222',
      'dongkhoi@lotteria.vn',
      4.20,
      ARRAY['https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80']::text[],
      '72 Le Thanh Ton',
      'Ben Nghe',
      'District 1',
      'Ho Chi Minh City',
      10.779000,
      106.703200,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_lotte_branch_id;
  ELSE
    UPDATE restaurant_branches
    SET
      name = 'Lotteria Vietnam - Vincom Dong Khoi',
      branch_phone = '028-3823-6222',
      branch_email = 'dongkhoi@lotteria.vn',
      rating = 4.20,
      images = ARRAY['https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80']::text[],
      street = '72 Le Thanh Ton',
      ward = 'Ben Nghe',
      district = 'District 1',
      city = 'Ho Chi Minh City',
      latitude = 10.779000,
      longitude = 106.703200,
      is_primary = TRUE,
      is_open = TRUE,
      updated_at = now()
    WHERE id = v_lotte_branch_id;
  END IF;

  FOR day_idx IN 0..6 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_opening_hours
      WHERE branch_id = v_lotte_branch_id AND day_of_week = day_idx
    ) THEN
      INSERT INTO branch_opening_hours (
        branch_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        overnight
      )
      VALUES (
        v_lotte_branch_id,
        day_idx,
        TIME '09:00',
        TIME '22:00',
        FALSE,
        FALSE
      );
    ELSE
      UPDATE branch_opening_hours
      SET
        open_time = TIME '09:00',
        close_time = TIME '22:00',
        is_closed = FALSE,
        overnight = FALSE,
        updated_at = now()
      WHERE branch_id = v_lotte_branch_id AND day_of_week = day_idx;
    END IF;
  END LOOP;

  SELECT id INTO v_lotte_rating_avg_id FROM branch_rating_avg WHERE branch_id = v_lotte_branch_id;
  IF v_lotte_rating_avg_id IS NULL THEN
    INSERT INTO branch_rating_avg (branch_id, avg_rating, total_ratings)
    VALUES (v_lotte_branch_id, 4.20, 650)
    RETURNING id INTO v_lotte_rating_avg_id;
  ELSE
    UPDATE branch_rating_avg
    SET
      avg_rating = 4.20,
      total_ratings = 650,
      last_updated = now()
    WHERE branch_id = v_lotte_branch_id;
  END IF;

  SELECT id INTO v_lotte_shrimp_burger_product_id
  FROM products
  WHERE restaurant_id = v_lotte_restaurant_id AND title = 'Shrimp Burger Deluxe';

  IF v_lotte_shrimp_burger_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_lotte_restaurant_id,
      'Shrimp Burger Deluxe',
      'Crispy shrimp patty with fresh lettuce, tartar sauce, and toasted bun.',
      ARRAY['https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80']::text[],
      'Burger',
      v_category_signature_burgers,
      88000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_lotte_shrimp_burger_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Crispy shrimp patty with fresh lettuce, tartar sauce, and toasted bun.',
      images = ARRAY['https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Burger',
      category_id = v_category_signature_burgers,
      base_price = 88000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_lotte_shrimp_burger_product_id;
  END IF;

  SELECT id INTO v_lotte_cheese_stick_product_id
  FROM products
  WHERE restaurant_id = v_lotte_restaurant_id AND title = 'Cheese Sticks Box';

  IF v_lotte_cheese_stick_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_lotte_restaurant_id,
      'Cheese Sticks Box',
      'Six mozzarella sticks served with Lotteria signature dipping sauce.',
      ARRAY['https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80']::text[],
      'Snack',
      v_category_street_snacks,
      52000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_lotte_cheese_stick_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Six mozzarella sticks served with Lotteria signature dipping sauce.',
      images = ARRAY['https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Snack',
      category_id = v_category_street_snacks,
      base_price = 52000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_lotte_cheese_stick_product_id;
  END IF;

  SELECT id INTO v_lotte_peach_tea_product_id
  FROM products
  WHERE restaurant_id = v_lotte_restaurant_id AND title = 'Peach Tea Cooler';

  IF v_lotte_peach_tea_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_lotte_restaurant_id,
      'Peach Tea Cooler',
      'Chilled peach iced tea with fruit chunks and lime.',
      ARRAY['https://images.unsplash.com/photo-1510626176961-4b37d0f0b56c?auto=format&fit=crop&w=1200&q=80']::text[],
      'Drink',
      v_category_value_drinks,
      39000,
      5,
      FALSE,
      FALSE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_lotte_peach_tea_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Chilled peach iced tea with fruit chunks and lime.',
      images = ARRAY['https://images.unsplash.com/photo-1510626176961-4b37d0f0b56c?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Drink',
      category_id = v_category_value_drinks,
      base_price = 39000,
      tax_rate = 5,
      is_tax_included = FALSE,
      popular = FALSE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_lotte_peach_tea_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_lotte_branch_id AND product_id = v_lotte_shrimp_burger_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 110,
      reserved_qty = 9,
      min_stock = 28,
      daily_limit = 210,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_lotte_branch_id AND product_id = v_lotte_shrimp_burger_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_lotte_branch_id,
      v_lotte_shrimp_burger_product_id,
      110,
      9,
      28,
      210,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_lotte_branch_id AND product_id = v_lotte_cheese_stick_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 150,
      reserved_qty = 12,
      min_stock = 35,
      daily_limit = 260,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_lotte_branch_id AND product_id = v_lotte_cheese_stick_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_lotte_branch_id,
      v_lotte_cheese_stick_product_id,
      150,
      12,
      35,
      260,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_lotte_branch_id AND product_id = v_lotte_peach_tea_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 220,
      reserved_qty = 14,
      min_stock = 60,
      daily_limit = NULL,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_lotte_branch_id AND product_id = v_lotte_peach_tea_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_lotte_branch_id,
      v_lotte_peach_tea_product_id,
      220,
      14,
      60,
      NULL,
      0,
      TRUE,
      TRUE
    );
  END IF;

  -- Jollibee Vietnam
  SELECT id INTO v_jollibee_restaurant_id FROM restaurants WHERE name = 'Jollibee Vietnam';
  IF v_jollibee_restaurant_id IS NULL THEN
    INSERT INTO restaurants (
      owner_id,
      name,
      description,
      about,
      cuisine,
      phone,
      email,
      logo,
      images,
      is_active,
      avg_branch_rating,
      total_branch_ratings
    )
    VALUES (
      gen_random_uuid(),
      'Jollibee Vietnam',
      'Beloved Filipino-style fried chicken and sweet-style spaghetti.',
      'Cheerful family restaurant bringing Chickenjoy, Jolly Spaghetti, and peach mango pies.',
      'Fast Food',
      '028-3910-9000',
      'care@jollibee.vn',
      ARRAY['https://upload.wikimedia.org/wikipedia/en/thumb/9/9a/Jollibee_logo.svg/512px-Jollibee_logo.svg.png']::text[],
      ARRAY[
        'https://images.unsplash.com/photo-1606902965551-dce093cda7f6?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      TRUE,
      4.40,
      720
    )
    RETURNING id INTO v_jollibee_restaurant_id;
  ELSE
    UPDATE restaurants
    SET
      description = 'Beloved Filipino-style fried chicken and sweet-style spaghetti.',
      about = 'Cheerful family restaurant bringing Chickenjoy, Jolly Spaghetti, and peach mango pies.',
      cuisine = 'Fast Food',
      phone = '028-3910-9000',
      email = 'care@jollibee.vn',
      logo = ARRAY['https://upload.wikimedia.org/wikipedia/en/thumb/9/9a/Jollibee_logo.svg/512px-Jollibee_logo.svg.png']::text[],
      images = ARRAY[
        'https://images.unsplash.com/photo-1606902965551-dce093cda7f6?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1600&q=80'
      ]::text[],
      avg_branch_rating = 4.40,
      total_branch_ratings = 720,
      is_active = TRUE,
      updated_at = now()
    WHERE id = v_jollibee_restaurant_id;
  END IF;

  SELECT id INTO v_jollibee_branch_id
  FROM restaurant_branches
  WHERE restaurant_id = v_jollibee_restaurant_id AND branch_number = 1;

  IF v_jollibee_branch_id IS NULL THEN
    INSERT INTO restaurant_branches (
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
    VALUES (
      v_jollibee_restaurant_id,
      1,
      'Jollibee Vietnam - Phu Nhuan',
      '028-3910-9001',
      'phunhuan@jollibee.vn',
      4.45,
      ARRAY['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80']::text[],
      '223 Le Van Sy',
      'Ward 13',
      'Phu Nhuan',
      'Ho Chi Minh City',
      10.794500,
      106.680200,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_jollibee_branch_id;
  ELSE
    UPDATE restaurant_branches
    SET
      name = 'Jollibee Vietnam - Phu Nhuan',
      branch_phone = '028-3910-9001',
      branch_email = 'phunhuan@jollibee.vn',
      rating = 4.45,
      images = ARRAY['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80']::text[],
      street = '223 Le Van Sy',
      ward = 'Ward 13',
      district = 'Phu Nhuan',
      city = 'Ho Chi Minh City',
      latitude = 10.794500,
      longitude = 106.680200,
      is_primary = TRUE,
      is_open = TRUE,
      updated_at = now()
    WHERE id = v_jollibee_branch_id;
  END IF;

  FOR day_idx IN 0..6 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_opening_hours
      WHERE branch_id = v_jollibee_branch_id AND day_of_week = day_idx
    ) THEN
      INSERT INTO branch_opening_hours (
        branch_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        overnight
      )
      VALUES (
        v_jollibee_branch_id,
        day_idx,
        TIME '08:30',
        TIME '22:30',
        FALSE,
        FALSE
      );
    ELSE
      UPDATE branch_opening_hours
      SET
        open_time = TIME '08:30',
        close_time = TIME '22:30',
        is_closed = FALSE,
        overnight = FALSE,
        updated_at = now()
      WHERE branch_id = v_jollibee_branch_id AND day_of_week = day_idx;
    END IF;
  END LOOP;

  SELECT id INTO v_jollibee_rating_avg_id FROM branch_rating_avg WHERE branch_id = v_jollibee_branch_id;
  IF v_jollibee_rating_avg_id IS NULL THEN
    INSERT INTO branch_rating_avg (branch_id, avg_rating, total_ratings)
    VALUES (v_jollibee_branch_id, 4.45, 720)
    RETURNING id INTO v_jollibee_rating_avg_id;
  ELSE
    UPDATE branch_rating_avg
    SET
      avg_rating = 4.45,
      total_ratings = 720,
      last_updated = now()
    WHERE branch_id = v_jollibee_branch_id;
  END IF;

  SELECT id INTO v_jollibee_chickenjoy_product_id
  FROM products
  WHERE restaurant_id = v_jollibee_restaurant_id AND title = 'Chickenjoy 2pc Combo';

  IF v_jollibee_chickenjoy_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_jollibee_restaurant_id,
      'Chickenjoy 2pc Combo',
      'Two-piece Chickenjoy with rice, gravy, and a chilled drink.',
      ARRAY['https://images.unsplash.com/photo-1606902965551-dce093cda7f6?auto=format&fit=crop&w=1200&q=80']::text[],
      'Combo',
      v_category_chicken_buckets,
      99000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_jollibee_chickenjoy_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Two-piece Chickenjoy with rice, gravy, and a chilled drink.',
      images = ARRAY['https://images.unsplash.com/photo-1606902965551-dce093cda7f6?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Combo',
      category_id = v_category_chicken_buckets,
      base_price = 99000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_jollibee_chickenjoy_product_id;
  END IF;

  SELECT id INTO v_jollibee_spaghetti_product_id
  FROM products
  WHERE restaurant_id = v_jollibee_restaurant_id AND title = 'Jolly Spaghetti Plate';

  IF v_jollibee_spaghetti_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_jollibee_restaurant_id,
      'Jolly Spaghetti Plate',
      'Sweet-style spaghetti with hotdog slices and cheese topping.',
      ARRAY['https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80']::text[],
      'Pasta',
      v_category_fast_food_classics,
      65000,
      8,
      FALSE,
      TRUE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_jollibee_spaghetti_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Sweet-style spaghetti with hotdog slices and cheese topping.',
      images = ARRAY['https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Pasta',
      category_id = v_category_fast_food_classics,
      base_price = 65000,
      tax_rate = 8,
      is_tax_included = FALSE,
      popular = TRUE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_jollibee_spaghetti_product_id;
  END IF;

  SELECT id INTO v_jollibee_pineapple_product_id
  FROM products
  WHERE restaurant_id = v_jollibee_restaurant_id AND title = 'Pineapple Juice Blends';

  IF v_jollibee_pineapple_product_id IS NULL THEN
    INSERT INTO products (
      restaurant_id,
      title,
      description,
      images,
      type,
      category_id,
      base_price,
      tax_rate,
      is_tax_included,
      popular,
      available,
      is_visible
    )
    VALUES (
      v_jollibee_restaurant_id,
      'Pineapple Juice Blends',
      'Tropical pineapple juice served over ice with nata de coco.',
      ARRAY['https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=1200&q=80']::text[],
      'Drink',
      v_category_value_drinks,
      35000,
      5,
      FALSE,
      FALSE,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_jollibee_pineapple_product_id;
  ELSE
    UPDATE products
    SET
      description = 'Tropical pineapple juice served over ice with nata de coco.',
      images = ARRAY['https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=1200&q=80']::text[],
      type = 'Drink',
      category_id = v_category_value_drinks,
      base_price = 35000,
      tax_rate = 5,
      is_tax_included = FALSE,
      popular = FALSE,
      available = TRUE,
      is_visible = TRUE,
      updated_at = now()
    WHERE id = v_jollibee_pineapple_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_jollibee_branch_id AND product_id = v_jollibee_chickenjoy_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 140,
      reserved_qty = 15,
      min_stock = 35,
      daily_limit = 240,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_jollibee_branch_id AND product_id = v_jollibee_chickenjoy_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_jollibee_branch_id,
      v_jollibee_chickenjoy_product_id,
      140,
      15,
      35,
      240,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_jollibee_branch_id AND product_id = v_jollibee_spaghetti_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 160,
      reserved_qty = 12,
      min_stock = 40,
      daily_limit = 280,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_jollibee_branch_id AND product_id = v_jollibee_spaghetti_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_jollibee_branch_id,
      v_jollibee_spaghetti_product_id,
      160,
      12,
      40,
      280,
      0,
      TRUE,
      TRUE
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory
    WHERE branch_id = v_jollibee_branch_id AND product_id = v_jollibee_pineapple_product_id
  ) THEN
    UPDATE inventory
    SET
      quantity = 210,
      reserved_qty = 18,
      min_stock = 55,
      daily_limit = NULL,
      daily_sold = 0,
      is_visible = TRUE,
      is_active = TRUE,
      updated_at = now()
    WHERE branch_id = v_jollibee_branch_id AND product_id = v_jollibee_pineapple_product_id;
  ELSE
    INSERT INTO inventory (
      branch_id,
      product_id,
      quantity,
      reserved_qty,
      min_stock,
      daily_limit,
      daily_sold,
      is_visible,
      is_active
    )
    VALUES (
      v_jollibee_branch_id,
      v_jollibee_pineapple_product_id,
      210,
      18,
      55,
      NULL,
      0,
      TRUE,
      TRUE
    );
  END IF;

END $$;




-- ✅ Cập nhật ảnh Hanuri Korean Fast Food
UPDATE restaurants
SET
  logo = ARRAY[
    'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=400&q=80'
  ]::text[],
  images = ARRAY[
    'data:image/jpeg;base64,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',
    'data:image/jpeg;base64,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'
  ]::text[],
  updated_at = now()
WHERE name = 'Hanuri Korean Fast Food';

-- ✅ Cập nhật ảnh Taste of Saigon
UPDATE restaurants
SET
  logo = ARRAY[
    'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=400&q=80'
  ]::text[],
  images = ARRAY[
    'data:image/jpeg;base64,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',
    'data:image/jpeg;base64,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'
  ]::text[],
  updated_at = now()
WHERE name = 'Taste of Saigon';

UPDATE restaurants
SET
  logo = ARRAY[
    'data:image/png;base64,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'
  ]::text[],
  images = ARRAY[
    'data:image/png;base64,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'  
    'data:image/png;base64,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'
   ]::text[],
  updated_at = now()
WHERE name = 'Mi Cay Sasin';


DO $$
DECLARE
  -- ====== URL ảnh: THAY bằng link thật của bạn ======
  v_sasin_logo   TEXT[] := ARRAY[
    'data:image/png;base64,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'
  ];
  v_sasin_images TEXT[] := ARRAY[
    'data:image/png;base64,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',
    'data:image/png;base64,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'
  ];

  v_pho_images        TEXT[] := ARRAY[
    'data:image/jpeg;base64,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',
    'data:image/jpeg;base64,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'
  ];
  v_caphesuada_images TEXT[] := ARRAY[
    'data:image/jpeg;base64,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'
  ];

  v_bibimbap_images   TEXT[] := ARRAY[
    'data:image/jpeg;base64,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',
    'data:image/jpeg;base64,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'
  ];
  v_tteokbokki_images TEXT[] := ARRAY[
    'data:image/jpeg;base64,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'
  ];
  v_yuja_images       TEXT[] := ARRAY[
    'data:image/jpeg;base64,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'
  ];

  -- ====== ID nhà hàng (tự tìm theo name để tránh sai ID) ======
  v_rest_sasin   UUID;
  v_rest_saigon  UUID;
  v_rest_hanuri  UUID;
  v_rest_busan   UUID;

  -- Đếm số dòng cập nhật
  n INT;
BEGIN
  -- Tìm restaurant IDs theo tên
  SELECT id INTO v_rest_sasin  FROM restaurants WHERE name ILIKE 'Mi Cay Sasin'                      LIMIT 1;
  SELECT id INTO v_rest_saigon FROM restaurants WHERE name ILIKE 'Taste of Saigon'                   LIMIT 1;
  SELECT id INTO v_rest_hanuri FROM restaurants WHERE name ILIKE 'Hanuri Korean Fast Food'           LIMIT 1;
  SELECT id INTO v_rest_busan  FROM restaurants WHERE name ILIKE 'Busan Korean Street Food'          LIMIT 1;

  -- 1) Cập nhật ảnh cho restaurant Mi Cay Sasin
  UPDATE restaurants
  SET logo = v_sasin_logo,
      images = v_sasin_images,
      updated_at = now()
  WHERE id = v_rest_sasin;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Mi Cay Sasin images: % row(s)', n;

  -- 2) Products thuộc Taste of Saigon: Pho Bo Dac Biet, Ca Phe Sua Da
  UPDATE products
  SET images = v_pho_images,
      updated_at = now()
  WHERE title = 'Pho Bo Dac Biet' AND restaurant_id = v_rest_saigon;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Pho Bo Dac Biet images: % row(s)', n;

  UPDATE products
  SET images = v_caphesuada_images,
      updated_at = now()
  WHERE title = 'Ca Phe Sua Da' AND restaurant_id = v_rest_saigon;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Ca Phe Sua Da images: % row(s)', n;

  -- 3) Product thuộc Hanuri: Beef Bibimbap Bowl & Yuja Sparkling Ade
  UPDATE products
  SET images = v_bibimbap_images,
      updated_at = now()
  WHERE title = 'Beef Bibimbap Bowl' AND restaurant_id = v_rest_hanuri;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Beef Bibimbap Bowl images: % row(s)', n;

  UPDATE products
  SET images = v_yuja_images,
      updated_at = now()
  WHERE title = 'Yuja Sparkling Ade' AND restaurant_id = v_rest_hanuri;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Yuja Sparkling Ade images: % row(s)', n;

  -- 4) Product thuộc Busan Korean Street Food: Busan Tteokbokki Supreme
  UPDATE products
  SET images = v_tteokbokki_images,
      updated_at = now()
  WHERE title = 'Busan Tteokbokki Supreme' AND restaurant_id = v_rest_busan;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Busan Tteokbokki Supreme images: % row(s)', n;

END $$;


DO $$
DECLARE
  v_rest_sasin UUID;
  v_img_beefhotpot TEXT[] := ARRAY[
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRYiKEkHjnYzC16uYJoXXJHGlXHMu30qg6Yfw&s' 
  ];
  v_img_seafood TEXT[] := ARRAY[
    'data:image/jpeg;base64,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'
  ];
  v_img_tteokbokki TEXT[] := ARRAY[
    'data:image/jpeg;base64,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'
  ];
  n INT;
BEGIN
  -- Lấy ID của nhà hàng “Mi Cay Sasin”
  SELECT id INTO v_rest_sasin FROM restaurants WHERE name ILIKE 'Mi Cay Sasin' LIMIT 1;

  -- 1️⃣ Premium Beef Hotpot
  UPDATE products
  SET images = v_img_beefhotpot,
      updated_at = now()
  WHERE restaurant_id = v_rest_sasin AND title = 'Premium Beef Hotpot';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Premium Beef Hotpot: % row(s)', n;

  -- 2️⃣ Level 5 Seafood Noodle Pot
  UPDATE products
  SET images = v_img_seafood,
      updated_at = now()
  WHERE restaurant_id = v_rest_sasin AND title = 'Level 5 Seafood Noodle Pot';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Level 5 Seafood Noodle Pot: % row(s)', n;

  -- 3️⃣ Cheese Tteokbokki Bites
  UPDATE products
  SET images = v_img_tteokbokki,
      updated_at = now()
  WHERE restaurant_id = v_rest_sasin AND title = 'Cheese Tteokbokki Bites';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Updated Cheese Tteokbokki Bites: % row(s)', n;
END $$;
