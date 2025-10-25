CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  provider VARCHAR(100),
  provider_data JSONB,
  last4 VARCHAR(4),
  brand VARCHAR(50),
  exp_month INT,
  exp_year INT,
  account_holder VARCHAR(150),
  account_number VARCHAR(34),
  bank_name VARCHAR(120),
  bank_code VARCHAR(50),
  is_default BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_user ON payment_methods(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_user_account
  ON payment_methods(user_id, account_number)
  WHERE account_number IS NOT NULL;

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS account_holder VARCHAR(150),
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(34),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS bank_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  payment_method_id UUID,
  idempotency_key VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  status VARCHAR(30) DEFAULT 'pending',
  transaction_id VARCHAR(200),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pay_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pay_idempotency ON payments(idempotency_key);

-- refunds
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);

-- payment_logs
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID,
  action VARCHAR(100),
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment ON payment_logs(payment_id);
