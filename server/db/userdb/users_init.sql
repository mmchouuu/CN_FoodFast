CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  phone VARCHAR(30),
  role VARCHAR(30) NOT NULL DEFAULT 'customer',
  tier VARCHAR(30) DEFAULT 'Bronze',
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(10),
  otp_expires TIMESTAMP,
  email_verified BOOLEAN DEFAULT FALSE,
  restaurant_name VARCHAR(150),
  company_address VARCHAR(255),
  tax_code VARCHAR(50),
  manager_name VARCHAR(150),
  restaurant_status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- user addresses
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(50),
  recipient VARCHAR(150),
  phone VARCHAR(30),
  street VARCHAR(200) NOT NULL,
  ward VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  instructions TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_primary ON user_addresses(user_id, is_primary);

ALTER TABLE user_addresses
  ADD COLUMN IF NOT EXISTS label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS recipient VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS instructions TEXT;

-- refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires_at ON refresh_tokens(expires_at);

-- Seed default restaurant owner account
DO $$
DECLARE
  v_owner_id UUID := 'd799adbe-6c5b-4b51-9832-9d364e9b9581';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_owner_id) THEN
    INSERT INTO users (
      id,
      first_name,
      last_name,
      email,
      password_hash,
      phone,
      role,
      tier,
      is_active,
      is_verified,
      is_approved,
      email_verified,
      restaurant_name,
      company_address,
      tax_code,
      manager_name,
      restaurant_status
    )
    VALUES (
      v_owner_id,
      'Huy',
      'Nguyen',
      'owner@tasteofsaigon.local',
      crypt('Restaurant@123', gen_salt('bf')),
      '0123456789',
      'restaurant',
      'Gold',
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      'Taste of Saigon',
      '123 Nguyen Hue, District 1, Ho Chi Minh City',
      'TX-123456789',
      'Nguyen Huy',
      'approved'
    );
  END IF;
END $$;
