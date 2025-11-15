-- 1) PLATFORM & RESTAURANT ACCOUNTS
-- =========================================================
CREATE TABLE IF NOT EXISTS restaurant_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,                  -- soft ref: product-service.restaurants.id
  branch_id UUID,                               -- soft ref: product-service.restaurant_branches.id
  account_holder VARCHAR(150) NOT NULL,
  account_number VARCHAR(34) NOT NULL,
  bank_name VARCHAR(120),
  bank_code VARCHAR(50),
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (restaurant_id, account_number)
);
CREATE INDEX IF NOT EXISTS idx_rpa_restaurant ON restaurant_payout_accounts(restaurant_id, is_default);

INSERT INTO restaurant_payout_accounts (
  restaurant_id,
  branch_id,
  account_holder,
  account_number,
  bank_name,
  bank_code,
  is_default
)
VALUES
  ('21111111-1111-4111-8111-000000000104', '31111111-1111-4111-8111-000000000208', 'Busan Bistro Nguyen Hue', '9704000015001', 'Techcombank', 'TCB', TRUE),
  ('21111111-1111-4111-8111-000000000104', '31111111-1111-4111-8111-000000000209', 'Busan Bistro Thao Dien', '9704000015002', 'VietinBank', 'ICB', TRUE),
  ('21111111-1111-4111-8111-000000000104', '31111111-1111-4111-8111-000000000210', 'Busan Bistro Phu My Hung', '9704000015003', 'Vietcombank', 'VCB', TRUE)
ON CONFLICT (restaurant_id, account_number) DO NOTHING;

-- ============================================================
-- PLATFORM_BANK_ACCOUNTS: tài khoản ngân hàng của nền tảng Admin
-- ============================================================
-- ============================================================
-- PLATFORM_BANK_ACCOUNTS: tài khoản ngân hàng của nền tảng Admin
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID,                       -- soft ref: user-service.users.id (Admin)
  owner_name VARCHAR(150) NOT NULL DEFAULT 'Platform Admin',
  account_number VARCHAR(34) NOT NULL,
  bank_name VARCHAR(120) NOT NULL,
  bank_code VARCHAR(50),
  branch_name VARCHAR(120),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  account_type VARCHAR(30) DEFAULT 'business'
    CHECK (account_type IN ('personal','business')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_number),
  CONSTRAINT chk_primary_single CHECK (is_primary IN (TRUE, FALSE))
);

CREATE INDEX IF NOT EXISTS idx_platform_bank_active
  ON platform_bank_accounts(is_active, is_primary);

-- ============================================================
-- Seed mặc định cho tài khoản ngân hàng của nền tảng
-- ============================================================
INSERT INTO platform_bank_accounts (
  owner_user_id,
  owner_name,
  account_number,
  bank_name,
  bank_code,
  branch_name,
  is_primary
)
VALUES
  ('11111111-1111-4111-8111-000000000001', 'FoodFast Platform Admin', '1234567890', 'Vietcombank', 'VCB', 'Ho Chi Minh Head Office', TRUE)
ON CONFLICT (account_number) DO NOTHING;

-- =========================================================
-- 2) CUSTOMER PAYMENT METHODS (Visa / MoMo)
-- =========================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                      -- soft ref: user-service.users.id
  type VARCHAR(50) NOT NULL                   -- 'card'|'wallet'|'bank_transfer'|'cod'
    CHECK (type IN ('card','wallet')),
  provider VARCHAR(100),                      -- 'stripe'|'zalopay'|'momo'|'napas'...
  provider_data JSONB,                        -- token, customerRef...
  last4 VARCHAR(4),
  brand VARCHAR(50),
  exp_month INT,
  exp_year INT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pm_user ON payment_methods(user_id);


-- =========================================================
-- 3) PAYMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,                     -- soft ref: order-service.orders.id
  user_id UUID NOT NULL,                      -- payer
  restaurant_id UUID NOT NULL,                -- phục vụ cho settlement
  branch_id UUID,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','cancelled','refunded','partially_refunded')),
  flow VARCHAR(20) NOT NULL DEFAULT 'online'
    CHECK (flow IN ('online')),
  transaction_id VARCHAR(200),                -- từ PSP (Stripe/MoMo)
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_payment_method_presence
    CHECK (payment_method_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_pay_order       ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pay_user        ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pay_restaurant  ON payments(restaurant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_pay_idempotency ON payments(idempotency_key);

-- =========================================================
-- 4) PAYMENT FEE COMPONENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS payment_fee_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  component_type VARCHAR(30) NOT NULL
    CHECK (component_type IN ('gateway_fee','platform_commission','tax_withheld','other')),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pfc_payment ON payment_fee_components(payment_id, component_type);

-- =========================================================
-- 5) REFUNDS (Chỉ Visa / MoMo)
-- =========================================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id UUID,
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reason VARCHAR(200),
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','cancelled')),
  method VARCHAR(20) NOT NULL DEFAULT 'to_source'
    CHECK (method IN ('to_source')),    -- chỉ hoàn qua cổng gốc
  destination_payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL, -- MoMo/Visa nhận hoàn
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_refund_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_user ON refunds(user_id);

-- =========================================================
-- 6) REFUND FEE COMPONENTS (Tuỳ PSP)
-- =========================================================
CREATE TABLE IF NOT EXISTS refund_fee_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  component_type VARCHAR(30) NOT NULL
    CHECK (component_type IN ('gateway_fee_refund','platform_commission_clawback','other')),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rfc_refund ON refund_fee_components(refund_id);

-- =========================================================
-- 7) PAYMENT LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID,
  action VARCHAR(100),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment ON payment_logs(payment_id);

-- =========================================================
-- 8) ORDER ↔ PAYMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS order_payments (
  order_id UUID NOT NULL,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  role VARCHAR(20) DEFAULT 'charge' CHECK (role IN ('charge','refund','tip')),
  PRIMARY KEY (order_id, payment_id)
);
CREATE INDEX IF NOT EXISTS idx_op_order ON order_payments(order_id);

-- =========================================================
-- 9) BRANCH CASH MANAGEMENT (KÉT)
-- =========================================================
-- CREATE TABLE IF NOT EXISTS branch_cash_sessions (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   branch_id UUID NOT NULL,
--   opened_by UUID,
--   closed_by UUID,
--   opening_float NUMERIC(12,2) NOT NULL DEFAULT 0,
--   closing_cash NUMERIC(12,2),
--   variance NUMERIC(12,2),
--   status VARCHAR(20) NOT NULL DEFAULT 'open'
--     CHECK (status IN ('open','closed')),
--   opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   closed_at TIMESTAMPTZ
-- );
-- CREATE INDEX IF NOT EXISTS idx_bcs_branch ON branch_cash_sessions(branch_id, status);

-- CREATE TABLE IF NOT EXISTS branch_cash_transactions (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   session_id UUID NOT NULL REFERENCES branch_cash_sessions(id) ON DELETE CASCADE,
--   order_id UUID,
--   txn_type VARCHAR(20) NOT NULL
--     CHECK (txn_type IN ('sale_cash','refund_cash','deposit_bank','withdrawal','adjustment')),
--   amount NUMERIC(12,2) NOT NULL,
--   note TEXT,
--   created_at TIMESTAMPTZ DEFAULT now()
-- );
-- CREATE INDEX IF NOT EXISTS idx_bct_session ON branch_cash_transactions(session_id, txn_type);
-- CREATE INDEX IF NOT EXISTS idx_bct_order ON branch_cash_transactions(order_id);

-- CREATE TABLE IF NOT EXISTS branch_cash_deposits (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   transaction_id UUID NOT NULL REFERENCES branch_cash_transactions(id) ON DELETE CASCADE,
--   bank_name VARCHAR(120),
--   bank_account VARCHAR(34),
--   slip_number VARCHAR(100),
--   deposited_amount NUMERIC(12,2) NOT NULL,
--   deposited_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
-- CREATE INDEX IF NOT EXISTS idx_bcd_txn ON branch_cash_deposits(transaction_id);

-- =========================================================
-- 10) SETTLEMENT / PAYOUT / INVOICE
-- =========================================================
CREATE TABLE restaurant_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',

  -- Chỉ giữ nhóm cột tương ứng
  gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  refunds NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_withheld NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_result NUMERIC(12,2) NOT NULL DEFAULT 0,

  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','ready','payout_scheduled','invoiced','closed')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (branch_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_rs_restaurant ON restaurant_settlements(restaurant_id, branch_id, period_start, period_end, status);

CREATE TABLE IF NOT EXISTS restaurant_settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES restaurant_settlements(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL
    CHECK (item_type IN ('payment','refund','adjustment')),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL,
  branch_id UUID,
  order_id UUID,
  amount NUMERIC(12,2) NOT NULL,                 -- dương/âm
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rsi_settlement ON restaurant_settlement_items(settlement_id, item_type);

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES restaurant_settlements(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  payout_account_id UUID NOT NULL REFERENCES restaurant_payout_accounts(id),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','paid','failed')),
  platform_bank_account_id UUID,
  transaction_ref VARCHAR(200),
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_rest ON payouts(restaurant_id, status);

CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES restaurant_settlements(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  amount_due NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid','partially_paid','paid','void')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_rest ON platform_invoices(restaurant_id, status, due_date);

CREATE TABLE IF NOT EXISTS platform_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('cash_commission','adjustment','tax','other')),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items ON platform_invoice_items(invoice_id, item_type);

-- =========================================================
-- 11) OUTBOX (Event-driven)
-- =========================================================
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_agg ON outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox(processed);

-- =========================================================
-- 12) PLATFORM TRANSACTIONS (DÒNG TIỀN NỀN TẢNG)
-- =========================================================
CREATE TABLE IF NOT EXISTS platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tham chiếu các nghiệp vụ có liên quan
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
  refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL,

  -- Tài khoản ngân hàng nguồn và đích
  platform_bank_account_id UUID REFERENCES platform_bank_accounts(id) ON DELETE SET NULL,
  restaurant_payout_account_id UUID REFERENCES restaurant_payout_accounts(id) ON DELETE SET NULL,

  -- Phân loại giao dịch
  txn_type VARCHAR(30) NOT NULL
    CHECK (txn_type IN (
      'inflow_payment',      -- tiền khách thanh toán vào nền tảng
      'outflow_payout',      -- nền tảng chuyển tiền cho nhà hàng
      'outflow_refund',      -- nền tảng hoàn tiền khách hàng
      'fee_income',          -- phí nền tảng thu được
      'adjustment'           -- điều chỉnh kế toán nội bộ
    )),

  source VARCHAR(50),       -- Stripe / MoMo / Manual / BankTransfer
  description TEXT,         -- mô tả chi tiết (ghi chú kế toán)
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending','completed','failed')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index hỗ trợ truy vấn báo cáo
CREATE INDEX IF NOT EXISTS idx_platform_txn_type
  ON platform_transactions(txn_type, occurred_at);

CREATE INDEX IF NOT EXISTS idx_platform_txn_status
  ON platform_transactions(status);

CREATE INDEX IF NOT EXISTS idx_platform_txn_payment
  ON platform_transactions(payment_id);

CREATE INDEX IF NOT EXISTS idx_platform_txn_payout
  ON platform_transactions(payout_id);

CREATE INDEX IF NOT EXISTS idx_platform_txn_refund
  ON platform_transactions(refund_id);


-- =========================================================
-- 13) PLATFORM LEDGER BALANCES (SỐ DƯ NỀN TẢNG)
-- =========================================================
CREATE TABLE IF NOT EXISTS platform_ledger_balances (
  platform_bank_account_id UUID PRIMARY KEY
    REFERENCES platform_bank_accounts(id) ON DELETE CASCADE,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  last_updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_balance_updated
  ON platform_ledger_balances(last_updated_at);


CREATE TABLE IF NOT EXISTS admin_payout_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  restaurant_name VARCHAR(150),
  branch_count INT DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_online_sales NUMERIC(12,2) DEFAULT 0,
  total_pending_payout NUMERIC(12,2) DEFAULT 0,
  last_payout_date DATE,
  overall_status VARCHAR(20) DEFAULT 'pending'
    CHECK (overall_status IN ('pending','processing','all_paid','failed')),
  updated_at TIMESTAMPTZ DEFAULT now()
);
