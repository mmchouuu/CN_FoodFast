-- -- Create a sample order for user A at restaurant ABC
-- INSERT INTO orders (user_id, restaurant_id, branch_id, status, payment_status, total_amount)
-- SELECT u.id, r.id, rb.id, 'pending', 'unpaid', 120000
-- FROM users u, restaurants r, restaurant_branches rb
-- WHERE u.email = 'a@example.com'
--   AND r.name = 'Nhà hàng ABC'
--   AND rb.restaurant_id = r.id
-- RETURNING id INTO TEMP TABLE tmp_order;

-- -- Insert order items
-- INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, product_snapshot)
-- SELECT o.id, p.id, 2, 60000, 120000, jsonb_build_object(
--   'title', p.title, 
--   'description', p.description,
--   'price', 60000
-- )
-- FROM tmp_order o, products p
-- WHERE p.title = 'Phở Bò';

WITH tmp_order AS (
    INSERT INTO orders (user_id, restaurant_id, branch_id, status, payment_status, total_amount)
    SELECT u.id, r.id, rb.id, 'pending', 'unpaid', 120000
    FROM users u
    JOIN restaurants r ON r.name='Nhà hàng ABC'
    JOIN restaurant_branches rb ON rb.restaurant_id=r.id
    WHERE u.email='a@example.com'
    RETURNING id
)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, product_snapshot)
SELECT o.id, p.id, 2, 60000, 120000, jsonb_build_object(
    'title', p.title,
    'description', p.description,
    'price', 60000
)
FROM tmp_order o
JOIN products p ON p.title='Phở Bò';
