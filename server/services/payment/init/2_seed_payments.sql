-- -- Insert payment method for user A
-- INSERT INTO payment_methods (user_id, type, provider, last4, brand, exp_month, exp_year)
-- SELECT id, 'card', 'VISA', '4242', 'VISA', 12, 2030
-- FROM users WHERE email = 'a@example.com'
-- RETURNING id INTO TEMP TABLE tmp_pm;

-- -- Insert payment for the order
-- INSERT INTO payments (order_id, user_id, payment_method_id, amount, currency, status, transaction_id, paid_at)
-- SELECT o.id, u.id, pm.id, o.total_amount, 'VND', 'completed', 'TX123456', now()
-- FROM orders o, users u, tmp_pm pm
-- WHERE u.email = 'a@example.com';


-- Lấy order của user A
WITH user_order AS (
  SELECT o.id AS order_id, u.id AS user_id
  FROM orders o
  JOIN users u ON u.email='a@example.com'
  WHERE o.status='pending'
)
-- Insert payment method
, pm AS (
  INSERT INTO payment_methods (user_id, type, provider, last4, brand, exp_month, exp_year)
  SELECT user_id, 'card', 'VISA', '4242', 'VISA', 12, 2030
  FROM user_order
  RETURNING id
)
-- Insert payment
INSERT INTO payments (order_id, user_id, payment_method_id, amount, currency, status, transaction_id, paid_at)
SELECT uo.order_id, uo.user_id, pm.id, o.total_amount, 'VND', 'completed', 'TX123456', now()
FROM user_order uo
JOIN pm ON TRUE
JOIN orders o ON o.id = uo.order_id;
