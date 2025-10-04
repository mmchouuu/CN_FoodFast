CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  email VARCHAR(150),
  images TEXT[],
  cuisine VARCHAR(100),
  rating NUMERIC(3,2) DEFAULT 0,
  is_open BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON restaurants(created_at);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine);

-- branches
CREATE TABLE IF NOT EXISTS restaurant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_number INT NOT NULL,
  name VARCHAR(150),
  street VARCHAR(200) NOT NULL,
  ward VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_restaurant_branch UNIQUE (restaurant_id, branch_number)
);

CREATE INDEX IF NOT EXISTS idx_branches_restaurant ON restaurant_branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_branches_city ON restaurant_branches(city);

-- products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  images TEXT[],
  category VARCHAR(100),
  type VARCHAR(50),
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- inventory per branch (cập nhật quantity & sold_quantity)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT DEFAULT 0,
  sold_quantity INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_inventory_branch_product_variant UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
