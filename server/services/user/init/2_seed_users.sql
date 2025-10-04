-- Insert sample users
INSERT INTO users (first_name, last_name, email, password_hash, phone, role)
VALUES
('Nguyen', 'Van A', 'a@example.com', 'hashed_password_123', '0901234567', 'customer'),
('Tran', 'Thi B', 'b@example.com', 'hashed_password_456', '0902345678', 'customer');

-- Insert sample addresses
INSERT INTO user_addresses (user_id, street, ward, district, city, is_primary)
SELECT id, '123 Lê Lợi', 'P. Bến Nghé', 'Q.1', 'HCM', true
FROM users WHERE email = 'a@example.com';

INSERT INTO user_addresses (user_id, street, ward, district, city, is_primary)
SELECT id, '456 Hai Bà Trưng', 'P.6', 'Q.3', 'HCM', true
FROM users WHERE email = 'b@example.com';

