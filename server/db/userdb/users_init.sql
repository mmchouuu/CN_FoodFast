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

-- =====================================================================
-- SEED SAMPLE OWNER ACCOUNTS AND RESTAURANT CONSOLE ACCESS
-- =====================================================================

INSERT INTO roles (code, description)
VALUES
  ('owner', 'Restaurant owner with console access')
ON CONFLICT (code) DO NOTHING;

DROP TABLE IF EXISTS tmp_owner_seed;
CREATE TEMP TABLE tmp_owner_seed (
  user_id UUID,
  restaurant_id UUID,
  account_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  legal_name TEXT,
  tax_code TEXT,
  company_address TEXT,
  manager_name TEXT,
  login_email TEXT,
  display_name TEXT,
  account_phone TEXT
);

INSERT INTO tmp_owner_seed (
  user_id,
  restaurant_id,
  account_id,
  email,
  first_name,
  last_name,
  phone,
  legal_name,
  tax_code,
  company_address,
  manager_name,
  login_email,
  display_name,
  account_phone
)
VALUES
  ('11111111-1111-4111-8111-000000000101'::uuid, '21111111-1111-4111-8111-000000000101'::uuid, '51111111-1111-4111-8111-000000000101'::uuid, 'lotte.owner@foodfast.vn', 'Minji', 'Park', '0901000101', 'Lotte Vietnam Co., Ltd.', '0101234561', '469 Le Loi, District 1, Ho Chi Minh City', 'Minji Park', 'owner@lottefoodhall.vn', 'Lotte Food Hall Owner', '02836223344'),
  ('11111111-1111-4111-8111-000000000102'::uuid, '21111111-1111-4111-8111-000000000102'::uuid, '51111111-1111-4111-8111-000000000102'::uuid, 'kfc.owner@foodfast.vn', 'David', 'Nguyen', '0902000202', 'KFC Vietnam JSC', '0301234562', '94 Nguyen Trai, District 5, Ho Chi Minh City', 'David Nguyen', 'owner@kfcvietnam.vn', 'KFC Vietnam Owner', '19006886'),
  ('11111111-1111-4111-8111-000000000103'::uuid, '21111111-1111-4111-8111-000000000103'::uuid, '51111111-1111-4111-8111-000000000103'::uuid, 'jollibee.owner@foodfast.vn', 'Maria', 'Tran', '0903000303', 'Jollibee Vietnam Co., Ltd.', '0301234563', '5 Tran Hung Dao, District 1, Ho Chi Minh City', 'Maria Tran', 'owner@jollibee.vn', 'Jollibee Vietnam Owner', '19001533'),
  ('11111111-1111-4111-8111-000000000104'::uuid, '21111111-1111-4111-8111-000000000104'::uuid, '51111111-1111-4111-8111-000000000104'::uuid, 'busan.owner@foodfast.vn', 'Jiho', 'Lee', '0904000404', 'Busan Bistro Company Limited', '0311234564', '12 Nguyen Hue, District 1, Ho Chi Minh City', 'Jiho Lee', 'owner@busanbistro.vn', 'Busan Bistro Owner', '02822997788'),
  ('11111111-1111-4111-8111-000000000105'::uuid, '21111111-1111-4111-8111-000000000105'::uuid, '51111111-1111-4111-8111-000000000105'::uuid, 'sasin.owner@foodfast.vn', 'Phuong', 'Le', '0905000505', 'Sasin Hotpot Vietnam', '0311234565', '88 Tran Hung Dao, District 5, Ho Chi Minh City', 'Phuong Le', 'owner@sasinhotpot.vn', 'Sasin Hotpot Owner', '02822112211'),
  ('11111111-1111-4111-8111-000000000106'::uuid, '21111111-1111-4111-8111-000000000106'::uuid, '51111111-1111-4111-8111-000000000106'::uuid, 'highlands.owner@foodfast.vn', 'Lan', 'Pham', '0906000606', 'Highlands Coffee Service JSC', '0311234566', '44 Ngo Duc Ke, District 1, Ho Chi Minh City', 'Lan Pham', 'owner@highlandscoffee.vn', 'Highlands Coffee Owner', '02862744444'),
  ('11111111-1111-4111-8111-000000000107'::uuid, '21111111-1111-4111-8111-000000000107'::uuid, '51111111-1111-4111-8111-000000000107'::uuid, 'katinat.owner@foodfast.vn', 'Bao', 'Vo', '0907000707', 'Katinat Saigon Kafe', '0311234567', '58 Ly Tu Trong, District 1, Ho Chi Minh City', 'Bao Vo', 'owner@katinat.vn', 'Katinat Owner', '02866886688'),
  ('11111111-1111-4111-8111-000000000108'::uuid, '21111111-1111-4111-8111-000000000108'::uuid, '51111111-1111-4111-8111-000000000108'::uuid, 'bonchon.owner@foodfast.vn', 'Hana', 'Kim', '0908000808', 'Bonchon Vietnam Ltd.', '0311234568', '5B Nguyen Thi Minh Khai, District 1, Ho Chi Minh City', 'Hana Kim', 'owner@bonchon.vn', 'Bonchon Owner', '02839393939'),
  ('11111111-1111-4111-8111-000000000109'::uuid, '21111111-1111-4111-8111-000000000109'::uuid, '51111111-1111-4111-8111-000000000109'::uuid, 'texas.owner@foodfast.vn', 'Quang', 'Pham', '0909000909', 'Texas Chicken Vietnam', '0311234569', '250 Le Loi, District 1, Ho Chi Minh City', 'Quang Pham', 'owner@texaschicken.vn', 'Texas Chicken Owner', '02838486666'),
  ('11111111-1111-4111-8111-000000000110'::uuid, '21111111-1111-4111-8111-000000000110'::uuid, '51111111-1111-4111-8111-000000000110'::uuid, 'pizza4ps.owner@foodfast.vn', 'Yuki', 'Matsumoto', '0910000100', 'Pizza 4Ps Corporation', '0311234570', '8/15 Le Thanh Ton, District 1, Ho Chi Minh City', 'Yuki Matsumoto', 'owner@pizza4ps.vn', 'Pizza 4Ps Owner', '02836229988');

INSERT INTO users (id, email, first_name, last_name, phone, is_active, email_verified)
SELECT user_id, email, first_name, last_name, phone, TRUE, TRUE
FROM tmp_owner_seed
ON CONFLICT (email) DO NOTHING;

WITH admin_user AS (
  SELECT id
  FROM users
  WHERE email = 'admin@foodfast.vn'
  LIMIT 1
)
INSERT INTO owner_profiles (
  user_id,
  legal_name,
  tax_code,
  company_address,
  manager_name,
  status,
  approved_by,
  approved_at
)
SELECT
  seed.user_id,
  seed.legal_name,
  seed.tax_code,
  seed.company_address,
  seed.manager_name,
  'approved',
  admin_user.id,
  now()
FROM tmp_owner_seed seed
CROSS JOIN admin_user
ON CONFLICT (user_id) DO NOTHING;

WITH owner_role AS (
  SELECT id
  FROM roles
  WHERE code = 'owner'
  LIMIT 1
)
INSERT INTO user_roles (user_id, role_id)
SELECT seed.user_id, owner_role.id
FROM tmp_owner_seed seed
CROSS JOIN owner_role
ON CONFLICT DO NOTHING;

WITH owner_role AS (
  SELECT id
  FROM roles
  WHERE code = 'owner'
  LIMIT 1
)
INSERT INTO user_credentials (user_id, role_id, password_hash, is_temp)
SELECT seed.user_id, owner_role.id, '$2b$10$fYqtZDmpJFbpSCE3OVaXMuOTBnbK.icYOjHM6gpDZsOibTEEq7mca', FALSE
FROM tmp_owner_seed seed
CROSS JOIN owner_role
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO restaurant_accounts (id, restaurant_id, login_email, display_name, phone, user_id, is_active)
SELECT account_id, restaurant_id, login_email, display_name, account_phone, user_id, TRUE
FROM tmp_owner_seed
ON CONFLICT (id) DO NOTHING;

INSERT INTO restaurant_account_credentials (account_id, password_hash, is_temp)
SELECT account_id, '$2b$10$fYqtZDmpJFbpSCE3OVaXMuOTBnbK.icYOjHM6gpDZsOibTEEq7mca', FALSE
FROM tmp_owner_seed
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO restaurant_account_memberships (
  account_id,
  restaurant_id,
  branch_id,
  role_in_restaurant,
  can_manage_branch,
  can_manage_menu,
  can_manage_orders,
  can_manage_finance,
  can_manage_staff,
  is_active
)
SELECT
  account_id,
  restaurant_id,
  NULL,
  'owner_main',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
FROM tmp_owner_seed
ON CONFLICT (account_id, branch_id) DO NOTHING;

DROP TABLE tmp_owner_seed;
