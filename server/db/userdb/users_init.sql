-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -- users table
-- CREATE TABLE IF NOT EXISTS users (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   first_name VARCHAR(50),
--   last_name VARCHAR(50),
--   email VARCHAR(150) UNIQUE NOT NULL,
--   password_hash VARCHAR(255),
--   phone VARCHAR(30),
--   role VARCHAR(30) NOT NULL DEFAULT 'customer',
--   tier VARCHAR(30) DEFAULT 'Bronze',
--   is_active BOOLEAN DEFAULT TRUE,
--   is_verified BOOLEAN DEFAULT FALSE,
--   is_approved BOOLEAN DEFAULT FALSE,
--   otp_code VARCHAR(10),
--   otp_expires TIMESTAMP,
--   email_verified BOOLEAN DEFAULT FALSE,
--   restaurant_name VARCHAR(150),
--   company_address VARCHAR(255),
--   tax_code VARCHAR(50),
--   manager_name VARCHAR(150),
--   restaurant_status VARCHAR(30) DEFAULT 'pending',
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- -- user addresses
-- CREATE TABLE IF NOT EXISTS user_addresses (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   label VARCHAR(50),
--   recipient VARCHAR(150),
--   phone VARCHAR(30),
--   street VARCHAR(200) NOT NULL,
--   ward VARCHAR(100),
--   district VARCHAR(100),
--   city VARCHAR(100),
--   instructions TEXT,
--   is_primary BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
-- CREATE INDEX IF NOT EXISTS idx_user_addresses_primary ON user_addresses(user_id, is_primary);

-- ALTER TABLE user_addresses
--   ADD COLUMN IF NOT EXISTS label VARCHAR(50),
--   ADD COLUMN IF NOT EXISTS recipient VARCHAR(150),
--   ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
--   ADD COLUMN IF NOT EXISTS instructions TEXT;

-- -- refresh tokens
-- CREATE TABLE IF NOT EXISTS refresh_tokens (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   token_hash TEXT NOT NULL,
--   expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
--   revoked BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
-- CREATE INDEX IF NOT EXISTS idx_refresh_expires_at ON refresh_tokens(expires_at);

-- =====================================================================
-- USER-SERVICE DDL (PostgreSQL)
-- Phân quyền restaurant: owner_main / owner / manager / staff
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1) USERS: một bản ghi duy nhất cho mỗi email (global users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(150) NOT NULL UNIQUE,
  first_name      VARCHAR(50),
  last_name       VARCHAR(50),
  phone           VARCHAR(30),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_active  ON users(is_active);

-- =====================================================================
-- 2) ROLES (global): customer / owner / admin
-- =====================================================================
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(30) UNIQUE NOT NULL
                CHECK (code IN ('customer','owner','admin')),
  description TEXT
);

-- =====================================================================
-- 3) USER_ROLES (global): một user có thể có nhiều vai trò
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL,
  role_id UUID NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- =====================================================================
-- 4) USER_CREDENTIALS (global): mật khẩu theo từng vai trò (login theo role)
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  role_id          UUID NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  is_temp          BOOLEAN NOT NULL DEFAULT FALSE,       -- mật khẩu tạm
  last_changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id),
  CONSTRAINT fk_user_credentials_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_credentials_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_role ON user_credentials(role_id);

-- =====================================================================
-- 5) CUSTOMER_PROFILES (global): hồ sơ khách hàng
-- =====================================================================
CREATE TABLE IF NOT EXISTS customer_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL,  -- 1-1 với users
  tier             VARCHAR(30) NOT NULL DEFAULT 'Bronze'
                     CHECK (tier IN ('Bronze','Silver','Gold','Platinum','Diamond')),
  loyalty_points   INT NOT NULL DEFAULT 0,
  total_spent      NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_upgrade_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_customer_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_tier ON customer_profiles(tier);

-- =====================================================================
-- 6) OWNER_PROFILES (global): hồ sơ chủ thương hiệu (duyệt bởi admin)
-- =====================================================================
CREATE TABLE IF NOT EXISTS owner_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL,  -- 1-1 với users
  legal_name       VARCHAR(150),
  tax_code         VARCHAR(50),
  company_address  VARCHAR(255),
  manager_name     VARCHAR(150),
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  approved_by      UUID,                 -- admin user_id (soft ref trong user-service)
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_owner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_owner_profiles_status      ON owner_profiles(status);
CREATE INDEX IF NOT EXISTS idx_owner_profiles_approved_by ON owner_profiles(approved_by);

-- =====================================================================
-- 7) ADMIN_PROFILES (global): hồ sơ quản trị hệ thống
-- =====================================================================
CREATE TABLE IF NOT EXISTS admin_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID UNIQUE NOT NULL,          -- 1-1 với users
  full_name    VARCHAR(150),
  position     VARCHAR(100),
  permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- quyền mở rộng
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_admin_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user ON admin_profiles(user_id);

-- =====================================================================
-- 8) USER_ADDRESSES (global): địa chỉ giao/nhận
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  label         VARCHAR(50),
  street        VARCHAR(200) NOT NULL,
  ward          VARCHAR(100),
  district      VARCHAR(100),
  city          VARCHAR(100),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user    ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_primary ON user_addresses(user_id, is_primary);

-- =====================================================================
-- 9) REFRESH_TOKENS (global): phiên đăng nhập (JWT refresh)
-- =====================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  token_hash  TEXT NOT NULL,                 -- lưu hash
  user_agent  TEXT,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_refresh_user     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires  ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_revoked  ON refresh_tokens(revoked);

-- =====================================================================
-- 10) USER_TOKENS (global): OTP/verification/reset
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  purpose     VARCHAR(30) NOT NULL
                 CHECK (purpose IN ('signup','login','reset','verify_email')),
  channel     VARCHAR(20) NOT NULL DEFAULT 'email'
                 CHECK (channel IN ('email','sms')),
  code_hash   TEXT NOT NULL,                 -- lưu hash, không plaintext
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_tokens_user ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_exp  ON user_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_tokens_active
  ON user_tokens(user_id, purpose)
  WHERE consumed_at IS NULL;

-- =====================================================================
-- 11) OUTBOX (global): event-driven integration
-- =====================================================================
CREATE TABLE IF NOT EXISTS outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type  VARCHAR(50) NOT NULL,      -- 'User','OwnerProfile','CustomerProfile',...
  aggregate_id    UUID NOT NULL,
  event_type      VARCHAR(100) NOT NULL,     -- 'UserRegistered','OwnerApproved',...
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_agg       ON outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox(processed, created_at);

-- =====================================================================
-- 12) RESTAURANT ACCOUNTS (tenant-scoped): tài khoản đăng nhập theo brand
--      Cho phép cùng email xuất hiện ở nhiều restaurant khác nhau.
-- =====================================================================
CREATE TABLE IF NOT EXISTS restaurant_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL,                 -- soft ref: restaurants.id
  login_email    VARCHAR(150) NOT NULL,         -- email đăng nhập scoped theo restaurant
  display_name   VARCHAR(150),
  phone          VARCHAR(30),
  user_id        UUID,                          -- OPTIONAL: liên kết user global
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, login_email),
  CONSTRAINT fk_restaurant_accounts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_restaurant_accounts_restaurant
  ON restaurant_accounts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_accounts_user
  ON restaurant_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_accounts_active
  ON restaurant_accounts(is_active);

-- =====================================================================
-- 13) CREDENTIALS cho tài khoản nhà hàng
-- =====================================================================
CREATE TABLE IF NOT EXISTS restaurant_account_credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  is_temp          BOOLEAN NOT NULL DEFAULT FALSE,
  last_changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id),
  CONSTRAINT fk_racc_account
    FOREIGN KEY (account_id) REFERENCES restaurant_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_racc_account ON restaurant_account_credentials(account_id);

-- =====================================================================
-- 14) MEMBERSHIPS: vai trò của account tại brand/branch
--      role_in_restaurant: owner_main / owner / manager / staff
--      - owner_main: brand-level (branch_id IS NULL) — duy nhất & active mỗi brand
--      - owner: brand-level hoặc branch-level (tùy nghiệp vụ)
--      - manager: bắt buộc branch-level (branch_id NOT NULL)
--      - staff:   bắt buộc branch-level (branch_id NOT NULL)
-- =====================================================================
CREATE TABLE IF NOT EXISTS restaurant_account_memberships (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           UUID NOT NULL,
  restaurant_id        UUID NOT NULL,           -- lặp lại để query nhanh/consistency
  branch_id            UUID,                    -- NULL => quyền cấp brand
  role_in_restaurant   VARCHAR(30) NOT NULL
                       CHECK (role_in_restaurant IN ('owner_main','owner','manager','staff')),
  -- Quyền hạt mịn (tùy chọn):
  can_manage_branch      BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_menu      BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_orders    BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_finance   BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_staff     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_ram_account
    FOREIGN KEY (account_id) REFERENCES restaurant_accounts(id) ON DELETE CASCADE,

  -- Ràng buộc logic phạm vi:
  -- - owner_main phải là brand-level (branch_id IS NULL)
  -- - manager/staff phải là branch-level (branch_id IS NOT NULL)
  -- - owner: cho phép cả brand-level (NULL) lẫn branch-level (NOT NULL)
  CONSTRAINT chk_ram_scope_logic CHECK (
    (role_in_restaurant = 'owner_main' AND branch_id IS NULL)
    OR
    (role_in_restaurant IN ('manager','staff') AND branch_id IS NOT NULL)
    OR
    (role_in_restaurant = 'owner')
  ),

  -- Một account chỉ có 1 membership cho mỗi branch (NULL = cấp brand)
  UNIQUE (account_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_ram_restaurant ON restaurant_account_memberships(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ram_branch     ON restaurant_account_memberships(branch_id);
CREATE INDEX IF NOT EXISTS idx_ram_role       ON restaurant_account_memberships(role_in_restaurant);
CREATE INDEX IF NOT EXISTS idx_ram_active     ON restaurant_account_memberships(is_active);

-- Mỗi restaurant chỉ có 1 owner_main đang hoạt động (brand-level)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ram_one_owner_main_per_restaurant
  ON restaurant_account_memberships(restaurant_id)
  WHERE role_in_restaurant = 'owner_main'
    AND is_active = TRUE
    AND branch_id IS NULL;

-- =====================================================================
-- 15) REFRESH TOKEN cho tài khoản nhà hàng (tách luồng với global)
-- =====================================================================
CREATE TABLE IF NOT EXISTS restaurant_account_refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  token_hash  TEXT NOT NULL,
  user_agent  TEXT,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_rart_account
    FOREIGN KEY (account_id) REFERENCES restaurant_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rart_account   ON restaurant_account_refresh_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_rart_expires   ON restaurant_account_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_rart_revoked   ON restaurant_account_refresh_tokens(revoked);

-- =====================================================================
-- 16) OTP/verification cho tài khoản nhà hàng
-- =====================================================================
CREATE TABLE IF NOT EXISTS restaurant_account_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  purpose     VARCHAR(30) NOT NULL
                CHECK (purpose IN ('login','reset','verify_email')),
  channel     VARCHAR(20) NOT NULL DEFAULT 'email'
                CHECK (channel IN ('email','sms')),
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_rat_account
    FOREIGN KEY (account_id) REFERENCES restaurant_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rat_account ON restaurant_account_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_rat_exp     ON restaurant_account_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rat_active
  ON restaurant_account_tokens(account_id, purpose)
  WHERE consumed_at IS NULL;

-- =============================
-- INSERT DEFAULT ADMIN ACCOUNT (password: admin123)
-- =============================

-- 1️⃣ Đảm bảo có role 'admin'
INSERT INTO roles (code, description)
VALUES ('admin', 'System administrator with full privileges')
ON CONFLICT (code) DO NOTHING;

-- 2️⃣ Tạo user admin
INSERT INTO users (email, first_name, last_name, phone, is_active, email_verified)
VALUES ('admin@foodfast.vn', 'System', 'Admin', '0900000000', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- 3️⃣ Gán role admin cho user này
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'admin'
WHERE u.email = 'admin@foodfast.vn'
ON CONFLICT DO NOTHING;

-- 4️⃣ Tạo mật khẩu cho admin (bcrypt của "admin123")
-- bcrypt hash: $2b$10$uZDWt4AjQ8RkM95TtZ9Fz.4yvuq38DJKxwFy0P9BFW86vujr0FtTe
INSERT INTO user_credentials (user_id, role_id, password_hash, is_temp)
SELECT u.id, r.id, '$2b$10$uZDWt4AjQ8RkM95TtZ9Fz.4yvuq38DJKxwFy0P9BFW86vujr0FtTe', FALSE
FROM users u
JOIN roles r ON r.code = 'admin'
WHERE u.email = 'admin@foodfast.vn'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 5️⃣ Hồ sơ admin chi tiết
INSERT INTO admin_profiles (user_id, full_name, position, permissions)
SELECT u.id, 'System Administrator', 'Super Admin', '{"all": true}'::jsonb
FROM users u
WHERE u.email = 'admin@foodfast.vn'
ON CONFLICT (user_id) DO NOTHING;
