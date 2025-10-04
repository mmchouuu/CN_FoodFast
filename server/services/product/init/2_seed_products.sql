-- -- Insert restaurant
-- INSERT INTO restaurants (name, description, phone, email, cuisine)
-- VALUES ('Nhà hàng ABC', 'Quán ăn Việt Nam', '0909999999', 'abc@restaurant.com', 'Vietnamese')
-- RETURNING id INTO TEMP TABLE tmp_restaurant;

-- -- Insert branch
-- INSERT INTO restaurant_branches (restaurant_id, branch_number, name, street, district, city, is_primary)
-- SELECT id, 1, 'Chi nhánh Q1', '12 Nguyễn Huệ', 'Q.1', 'HCM', true
-- FROM tmp_restaurant;

-- -- Insert product
-- INSERT INTO products (restaurant_id, title, description, category, type, base_price, popular)
-- SELECT id, 'Phở Bò', 'Phở bò truyền thống', 'Món chính', 'food', 50000, true
-- FROM tmp_restaurant
-- RETURNING id INTO TEMP TABLE tmp_product;

-- -- Insert product variant
-- INSERT INTO product_variants (product_id, sku, variant_name, price)
-- SELECT id, 'PHO-BO-01', 'Tô nhỏ', 45000 FROM tmp_product
-- UNION ALL
-- SELECT id, 'PHO-BO-02', 'Tô lớn', 60000 FROM tmp_product;

-- -- Insert inventory
-- INSERT INTO inventory (branch_id, product_id, quantity)
-- SELECT rb.id, p.id, 100
-- FROM restaurant_branches rb, tmp_product p;

-- Insert restaurant và lấy id
WITH inserted_rest AS (
  INSERT INTO restaurants (name, description, phone, email, cuisine)
  VALUES ('Nhà hàng ABC', 'Quán ăn Việt Nam', '0909999999', 'abc@restaurant.com', 'Vietnamese')
  RETURNING id
)
-- Insert branch
INSERT INTO restaurant_branches (restaurant_id, branch_number, name, street, district, city, is_primary)
SELECT id, 1, 'Chi nhánh Q1', '12 Nguyễn Huệ', 'Q.1', 'HCM', TRUE
FROM inserted_rest
RETURNING id AS branch_id;

-- Insert product
WITH inserted_rest AS (
  SELECT id FROM restaurants WHERE email='abc@restaurant.com'
),
inserted_prod AS (
  INSERT INTO products (restaurant_id, title, description, category, type, base_price, popular)
  SELECT id, 'Phở Bò', 'Phở bò truyền thống', 'Món chính', 'food', 50000, TRUE
  FROM inserted_rest
  RETURNING id
)
-- Insert variants
INSERT INTO product_variants (product_id, sku, variant_name, price)
SELECT id, 'PHO-BO-01', 'Tô nhỏ', 45000 FROM inserted_prod
UNION ALL
SELECT id, 'PHO-BO-02', 'Tô lớn', 60000 FROM inserted_prod;

-- Insert inventory
INSERT INTO inventory (branch_id, product_id, quantity)
SELECT rb.id, p.id, 100
FROM restaurant_branches rb
CROSS JOIN (SELECT id FROM products WHERE title='Phở Bò') p;
