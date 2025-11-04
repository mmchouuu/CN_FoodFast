CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- 1) BANK ACCOUNTS
-- =========================================================
-- Customer bank accounts (chuyển khoản/hoàn tiền)
CREATE TABLE IF NOT EXISTS user_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                       -- soft ref: user-service.users.id
  account_holder VARCHAR(150) NOT NULL,
  account_number VARCHAR(34)  NOT NULL,
  bank_name VARCHAR(120),
  bank_code VARCHAR(50),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, account_number)
);
CREATE INDEX IF NOT EXISTS idx_uba_user ON user_bank_accounts(user_id, is_default);

-- Restaurant payout accounts (đích nhận tiền)
CREATE TABLE IF NOT EXISTS restaurant_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,                -- soft ref: product-service.restaurants.id
  account_holder VARCHAR(150) NOT NULL,
  account_number VARCHAR(34)  NOT NULL,
  bank_name VARCHAR(120),
  bank_code VARCHAR(50),
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (restaurant_id, account_number)
);
CREATE INDEX IF NOT EXISTS idx_rpa_restaurant ON restaurant_payout_accounts(restaurant_id, is_default);

-- Platform bank accounts (kho tiền online)
CREATE TABLE IF NOT EXISTS platform_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name VARCHAR(150) NOT NULL DEFAULT 'Platform Admin',
  account_number VARCHAR(34) NOT NULL,
  bank_name VARCHAR(120),
  bank_code VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_number)
);
CREATE INDEX IF NOT EXISTS idx_pba_active ON platform_bank_accounts(is_active, is_primary);

-- =========================================================
-- 2) CUSTOMER PAYMENT METHODS
-- =========================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                      -- soft ref: user-service.users.id
  type VARCHAR(50) NOT NULL                   -- 'card'|'wallet'|'bank_transfer'|'cod'
    CHECK (type IN ('card','wallet','bank_transfer','cod')),
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
CREATE INDEX IF NOT EXISTS idx_pm_type ON payment_methods(type);

-- =========================================================
-- 3) PAYMENTS / FEES / REFUNDS / LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,                 -- soft ref: order-service.orders.id
  user_id UUID NOT NULL,                  -- payer
  restaurant_id UUID NOT NULL,            -- để settlement
  branch_id UUID,
  payment_method_id UUID,                 -- optional
  idempotency_key VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','authorized','succeeded','failed','cancelled','refunded','partially_refunded')),
  flow VARCHAR(20) NOT NULL DEFAULT 'online'    -- 'online'|'cash'
    CHECK (flow IN ('online','cash')),
  transaction_id VARCHAR(200),                  -- từ PSP (nếu online)
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_order       ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pay_user        ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pay_restaurant  ON payments(restaurant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_pay_idempotency ON payments(idempotency_key);

-- Fees chi tiết cho payment online
CREATE TABLE IF NOT EXISTS payment_fee_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  component_type VARCHAR(30) NOT NULL       -- 'gateway_fee'|'platform_commission'|'tax_withheld'|'other'
    CHECK (component_type IN ('gateway_fee','platform_commission','tax_withheld','other')),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pfc_payment ON payment_fee_components(payment_id, component_type);

-- Refunds (online/cash)
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id UUID,                           -- soft ref
  amount NUMERIC(12,2) NOT NULL,
  reason VARCHAR(200),
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','cancelled')),
  -- mở rộng ngữ cảnh
  idempotency_key VARCHAR(255),
  flow VARCHAR(20) DEFAULT 'online' CHECK (flow IN ('online','cash')),
  method VARCHAR(20) CHECK (method IN ('to_source','bank_transfer','cash')),
  user_bank_account_id UUID,               -- nếu method='bank_transfer'
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_idem
  ON refunds(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);

-- Phí/khấu trừ trên refund (tuỳ PSP)
CREATE TABLE IF NOT EXISTS refund_fee_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  component_type VARCHAR(30) NOT NULL   -- 'gateway_fee_refund'|'platform_commission_clawback'|'other'
    CHECK (component_type IN ('gateway_fee_refund','platform_commission_clawback','other')),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rfc_refund ON refund_fee_components(refund_id);

-- Logs
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID,
  action VARCHAR(100),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment ON payment_logs(payment_id);

-- =========================================================
-- 4) (NỐI) ORDER_PAYMENTS: link nhiều payment cho 1 order
-- =========================================================
CREATE TABLE IF NOT EXISTS order_payments (
  order_id UUID NOT NULL,                         -- soft ref: order-service.orders.id
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  role VARCHAR(20) DEFAULT 'charge' CHECK (role IN ('charge','refund','tip')),
  PRIMARY KEY (order_id, payment_id)
);
CREATE INDEX IF NOT EXISTS idx_op_order ON order_payments(order_id);

-- =========================================================
-- 5) CASH AT BRANCH (két)
-- =========================================================
CREATE TABLE IF NOT EXISTS branch_cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,                          -- soft ref: product-service.restaurant_branches
  opened_by UUID,
  closed_by UUID,
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(12,2),
  variance NUMERIC(12,2),
  status VARCHAR(20) NOT NULL DEFAULT 'open'        -- 'open'|'closed'
    CHECK (status IN ('open','closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bcs_branch ON branch_cash_sessions(branch_id, status);

CREATE TABLE IF NOT EXISTS branch_cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES branch_cash_sessions(id) ON DELETE CASCADE,
  order_id UUID,                                   -- soft ref order-service
  txn_type VARCHAR(20) NOT NULL                    -- 'sale_cash'|'refund_cash'|'deposit_bank'|'withdrawal'|'adjustment'
    CHECK (txn_type IN ('sale_cash','refund_cash','deposit_bank','withdrawal','adjustment')),
  amount NUMERIC(12,2) NOT NULL,                   -- dương = vào két; âm = ra két
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bct_session ON branch_cash_transactions(session_id, txn_type);
CREATE INDEX IF NOT EXISTS idx_bct_order   ON branch_cash_transactions(order_id);

CREATE TABLE IF NOT EXISTS branch_cash_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES branch_cash_transactions(id) ON DELETE CASCADE,
  bank_name VARCHAR(120),
  bank_account VARCHAR(34),
  slip_number VARCHAR(100),
  deposited_amount NUMERIC(12,2) NOT NULL,
  deposited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bcd_txn ON branch_cash_deposits(transaction_id);

-- =========================================================
-- 6) SETTLEMENT / PAYOUT / INVOICE
-- =========================================================
CREATE TABLE IF NOT EXISTS restaurant_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',

  -- Online (tiền ở platform)
  online_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_gateway_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_platform_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_tax_withheld NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_refunds NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_net_payable NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Cash (tiền ở restaurant)
  cash_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_refunds NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_platform_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_due_to_platform NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Bù trừ
  net_result NUMERIC(12,2) NOT NULL DEFAULT 0,     -- online_net_payable - cash_due_to_platform
  status VARCHAR(20) NOT NULL DEFAULT 'open'       -- 'open'|'ready'|'payout_scheduled'|'invoiced'|'closed'
    CHECK (status IN ('open','ready','payout_scheduled','invoiced','closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (restaurant_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_rs_restaurant ON restaurant_settlements(restaurant_id, period_start, period_end, status);

CREATE TABLE IF NOT EXISTS restaurant_settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES restaurant_settlements(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL                 -- 'payment'|'refund'|'cash_sale'|'cash_refund'|'adjustment'
    CHECK (item_type IN ('payment','refund','cash_sale','cash_refund','adjustment')),
  payment_id UUID,
  refund_id UUID,
  branch_id UUID,
  order_id UUID,
  amount NUMERIC(12,2) NOT NULL,                 -- dương/âm
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rsi_settlement ON restaurant_settlement_items(settlement_id, item_type);

-- Payout khi net_result > 0
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES restaurant_settlements(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  payout_account_id UUID NOT NULL REFERENCES restaurant_payout_accounts(id),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'  -- 'pending'|'processing'|'paid'|'failed'
    CHECK (status IN ('pending','processing','paid','failed')),
  platform_bank_account_id UUID,
  transaction_ref VARCHAR(200),
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_rest ON payouts(restaurant_id, status);

-- Invoice thu phí khi net_result < 0
CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES restaurant_settlements(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  amount_due NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid'    -- 'unpaid'|'partially_paid'|'paid'|'void'
    CHECK (status IN ('unpaid','partially_paid','paid','void')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_rest ON platform_invoices(restaurant_id, status, due_date);

CREATE TABLE IF NOT EXISTS platform_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL                  -- 'cash_commission'|'adjustment'|'tax'|'other'
    CHECK (item_type IN ('cash_commission','adjustment','tax','other')),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items ON platform_invoice_items(invoice_id, item_type);

-- =========================================================
-- 7) OUTBOX (event-driven)
-- =========================================================
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL,   -- 'Payment','Refund','Payout','Invoice','Settlement'
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_agg       ON outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox(processed);
