CREATE TABLE IF NOT EXISTS drones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(50) UNIQUE NOT NULL,
  model VARCHAR(100),

  max_payload NUMERIC(6,2),
  battery_level INT DEFAULT 100,

  status VARCHAR(20) NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle','assigned','flying','charging','offline')),

  branch_id UUID,   -- NEW

  last_known_position JSONB,
  last_active_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE IF NOT EXISTS drone_branch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  drone_id UUID NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,           -- chi nhánh mới của drone

  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);


CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL,
  branch_id UUID NOT NULL,

  provider_type VARCHAR(20) NOT NULL DEFAULT 'drone'
    CHECK (provider_type IN ('drone', 'shipper')),

  drone_id UUID REFERENCES drones(id),
  drone_snapshot JSONB,

  delivery_address JSONB NOT NULL,
  branch_location JSONB NOT NULL,

  route JSONB,
  distance_meters INT,
  estimated_time_sec INT,

  current_position JSONB,
  progress_percent INT DEFAULT 0,

  delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN (
      'pending','assigned','flying','arriving','completed','failed','cancelled'
    )),

  pickup_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE IF NOT EXISTS drone_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  drone_id UUID NOT NULL REFERENCES drones(id),

  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE IF NOT EXISTS drone_tracking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  drone_id UUID NOT NULL REFERENCES drones(id),
  delivery_id UUID REFERENCES deliveries(id),

  position JSONB NOT NULL,
  battery_level INT,
  speed NUMERIC(6,2),

  created_at TIMESTAMPTZ DEFAULT now()
);
