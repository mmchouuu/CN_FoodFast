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




