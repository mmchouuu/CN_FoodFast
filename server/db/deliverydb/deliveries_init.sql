-- CREATE TABLE IF NOT EXISTS drones (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   code VARCHAR(50) UNIQUE NOT NULL,
--   model VARCHAR(100),

--   max_payload NUMERIC(6,2),
--   battery_level INT DEFAULT 100,

--   status VARCHAR(20) NOT NULL DEFAULT 'idle'
--     CHECK (status IN ('idle','assigned','flying','charging','maintenance','offline')),

--   branch_id UUID,   
--   image_url TEXT, 

--   last_known_position JSONB,
--   last_active_at TIMESTAMPTZ,

--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );


-- CREATE TABLE IF NOT EXISTS drone_branch_history (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   drone_id UUID NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
--   branch_id UUID NOT NULL,           -- chi nhánh mới của drone

--   assigned_by UUID,
--   assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   note TEXT
-- );


-- CREATE TABLE IF NOT EXISTS deliveries (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   order_id UUID NOT NULL,
--   branch_id UUID NOT NULL,

--   provider_type VARCHAR(20) NOT NULL DEFAULT 'drone'
--     CHECK (provider_type IN ('drone', 'shipper')),

--   drone_id UUID REFERENCES drones(id),
--   drone_snapshot JSONB,

--   delivery_address JSONB NOT NULL,
--   branch_location JSONB NOT NULL,

--   route JSONB,
--   distance_meters INT,
--   estimated_time_sec INT,

--   current_position JSONB,
--   progress_percent INT DEFAULT 0,

--   delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending'
--     CHECK (delivery_status IN (
--       'pending','assigned','flying','arriving','completed','failed','cancelled'
--     )),

--   pickup_at TIMESTAMPTZ,
--   delivered_at TIMESTAMPTZ,
--   failed_reason TEXT,

--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );


-- CREATE TABLE IF NOT EXISTS drone_assignments (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
--   drone_id UUID NOT NULL REFERENCES drones(id),

--   assigned_by UUID,
--   assigned_at TIMESTAMPTZ DEFAULT now(),

--   created_at TIMESTAMPTZ DEFAULT now()
-- );


-- CREATE TABLE IF NOT EXISTS drone_tracking_logs (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   drone_id UUID NOT NULL REFERENCES drones(id),
--   delivery_id UUID REFERENCES deliveries(id),

--   position JSONB NOT NULL,
--   battery_level INT,
--   speed NUMERIC(6,2),

--   created_at TIMESTAMPTZ DEFAULT now()
-- );

-- CREATE TABLE IF NOT EXISTS drone_maintenance (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   drone_id UUID NOT NULL REFERENCES drones(id) ON DELETE CASCADE,

--   schedule_date DATE NOT NULL,         -- ngày bảo trì dự kiến
--   maintenance_date TIMESTAMPTZ,        -- ngày bảo trì thực tế

--   status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
--     CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),

--   maintenance_type VARCHAR(50) NOT NULL,  
--     -- 'battery_check', 'motor_service', 'full_service', 'firmware_update'

--   description TEXT,

--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );

-- CREATE TABLE IF NOT EXISTS drone_maintenance_logs (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--   maintenance_id UUID NOT NULL REFERENCES drone_maintenance(id) ON DELETE CASCADE,

--   log_type VARCHAR(20) NOT NULL
--     CHECK (log_type IN ('note','error','part_replaced','inspection')),

--   message TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT now()
-- );


-- -- ===========================================
-- INSERT INTO drones (
--   code, model, max_payload, battery_level, status, branch_id, image_url,
--   last_known_position, last_active_at
-- )
-- VALUES
--   (
--     'DRONE-01',
--     'DJI Mavic Air 2',
--     2.00,
--     95,
--     'idle',
--     '31111111-1111-4111-8111-000000000208',
--     'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
--     '{"lat": 10.7875, "lng": 106.7009}',
--     now()
--   ),
--   (
--     'DRONE-02',
--     'DJI Mini Pro 3',
--     1.50,
--     78,
--     'idle',
--     '31111111-1111-4111-8111-000000000208',
--     'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
--     '{"lat": 10.7879, "lng": 106.7012}',
--     now()
--   ),
--   (
--     'DRONE-03',
--     'DJI Matrice 30',
--     3.50,
--     62,
--     'charging',
--     '31111111-1111-4111-8111-000000000208',
--     'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
--     '{"lat": 10.7883, "lng": 106.6999}',
--     now()
--   ),
--   (
--     'DRONE-04',
--     'Autel Evo Lite+',
--     2.20,
--     88,
--     'assigned',
--     '31111111-1111-4111-8111-000000000209',
--     'https://shop.autelrobotics.com/cdn/shop/products/7_900x.png?v=1760996980',
--     '{"lat": 10.7811, "lng": 106.6991}',
--     now()
--   ),
--   (
--     'DRONE-05',
--     'DJI Phantom 4 Pro',
--     1.80,
--     54,
--     'flying',
--     '31111111-1111-4111-8111-000000000209',
--     'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTSBkqJuV_EIskYU3ep5mbEdBhE93FUiul1eQ&s',
--     '{"lat": 10.7804, "lng": 106.6987}',
--     now()
--   ),
--   (
--     'DRONE-06',
--     'DJI Air 3',
--     2.50,
--     100,
--     'offline',
--     '31111111-1111-4111-8111-000000000209',
--     'https://product.hstatic.net/200000843159/product/f677e5b33d9798e86763cd46db133263_ultra_1e2f9362550d48b0854dfb522e947bf5_master.jpg',
--     '{"lat": 10.7832, "lng": 106.7021}',
--     now()
--   ),
--   (
--     'DRONE-07',
--     'DJI Mavic 3 Classic',
--     2.20,
--     90,
--     'idle',
--     '31111111-1111-4111-8111-000000000210',
--     'https://product.hstatic.net/200000843159/product/7a4a78878dda83106670ab3f4cd42c05_ultra_948b53d8d58846a5b143c19f3363d131_master.jpg',
--     '{"lat": 10.77985, "lng": 106.69052}',
--     now()
--   ),
--   (
--     'DRONE-08',
--     'DJI Mini 4 Pro',
--     1.50,
--     72,
--     'flying',
--     '31111111-1111-4111-8111-000000000210',
--     'https://product.hstatic.net/200000843159/product/mini_4pro_deb45ae4395c409b8245c65009fdf62c.jpg',
--     '{"lat": 10.78144, "lng": 106.68897}',
--     now()
--   ),
--   (
--     'DRONE-09',
--     'Autel Evo II Pro',
--     3.00,
--     56,
--     'charging',
--     '31111111-1111-4111-8111-000000000210',
--     'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHoBgZ5BeQ5R5Cz8goOb-_LwUZC4lHanlOSg&s',
--     '{"lat": 10.78421, "lng": 106.68715}',
--     now()
--   );



CREATE TABLE drone_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address TEXT,
  location JSONB, -- {"lat": 10.78, "lng": 106.69}
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(50) UNIQUE NOT NULL,
  model VARCHAR(100),

  max_payload NUMERIC(6,2),
  battery_level INT DEFAULT 100,

  status VARCHAR(20) NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle','assigned','flying','charging','maintenance','offline')),

  hub_id UUID REFERENCES drone_hubs(id),    
  image_url TEXT,

  last_known_position JSONB,
  last_active_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drone_hub_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id UUID NOT NULL REFERENCES drones(id),
  hub_id UUID NOT NULL REFERENCES drone_hubs(id),
  assigned_at TIMESTAMPTZ DEFAULT now()
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

--====================================================
INSERT INTO drone_hubs (id, name, address, location)
VALUES
  ('40111111-1111-4111-8111-000000000001',
   'Saigon Drone Hub A',
   '12 Pasteur, District 1, HCMC',
   '{"lat": 10.7791, "lng": 106.6987}'),

  ('40111111-1111-4111-8111-000000000002',
   'Saigon Drone Hub B',
   '23 Nguyen Hue, District 1, HCMC',
   '{"lat": 10.7764, "lng": 106.7002}'),

  ('40111111-1111-4111-8111-000000000003',
   'Saigon Drone Hub C',
   '88 Vo Thi Sau, District 3, HCMC',
   '{"lat": 10.7821, "lng": 106.6892}');

INSERT INTO drones (
  code, model, max_payload, battery_level, status, hub_id, image_url,
  last_known_position, last_active_at
)
VALUES
  -- ==========================
  -- HUB A: DRONE 1-3
  -- ==========================
  (
    'DRONE-01', 'DJI Mavic Air 2', 2.00, 95, 'idle',
    '40111111-1111-4111-8111-000000000001',
    'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
    '{"lat": 10.7875, "lng": 106.7009}', now()
  ),
  (
    'DRONE-02', 'DJI Mini Pro 3', 1.50, 78, 'idle',
    '40111111-1111-4111-8111-000000000001',
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
    '{"lat": 10.7879, "lng": 106.7012}', now()
  ),
  (
    'DRONE-03', 'DJI Matrice 30', 3.50, 62, 'charging',
    '40111111-1111-4111-8111-000000000001',
    'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
    '{"lat": 10.7883, "lng": 106.6999}', now()
  ),

  -- ==========================
  -- HUB B: DRONE 4-6
  -- ==========================
  (
    'DRONE-04', 'Autel Evo Lite+', 2.20, 88, 'assigned',
    '40111111-1111-4111-8111-000000000002',
    'https://shop.autelrobotics.com/cdn/shop/products/7_900x.png?v=1760996980',
    '{"lat": 10.7811, "lng": 106.6991}', now()
  ),
  (
    'DRONE-05', 'DJI Phantom 4 Pro', 1.80, 54, 'flying',
    '40111111-1111-4111-8111-000000000002',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTSBkqJuV_EIskYU3ep5mbEdBhE93FUiul1eQ&s',
    '{"lat": 10.7804, "lng": 106.6987}', now()
  ),
  (
    'DRONE-06', 'DJI Air 3', 2.50, 100, 'offline',
    '40111111-1111-4111-8111-000000000002',
    'https://product.hstatic.net/200000843159/product/f677e5b33d9798e86763cd46db133263_ultra_1e2f9362550d48b0854dfb522e947bf5_master.jpg',
    '{"lat": 10.7832, "lng": 106.7021}', now()
  ),

  -- ==========================
  -- HUB C: DRONE 7-9
  -- ==========================
  (
    'DRONE-07', 'DJI Mavic 3 Classic', 2.20, 90, 'idle',
    '40111111-1111-4111-8111-000000000003',
    'https://product.hstatic.net/200000843159/product/7a4a78878dda83106670ab3f4cd42c05_ultra_948b53d8d58846a5b143c19f3363d131_master.jpg',
    '{"lat": 10.77985, "lng": 106.69052}', now()
  ),
  (
    'DRONE-08', 'DJI Mini 4 Pro', 1.50, 72, 'flying',
    '40111111-1111-4111-8111-000000000003',
    'https://product.hstatic.net/200000843159/product/mini_4pro_deb45ae4395c409b8245c65009fdf62c.jpg',
    '{"lat": 10.78144, "lng": 106.68897}', now()
  ),
  (
    'DRONE-09', 'Autel Evo II Pro', 3.00, 56, 'charging',
    '40111111-1111-4111-8111-000000000003',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHoBgZ5BeQ5R5Cz8goOb-_LwUZC4lHanlOSg&s',
    '{"lat": 10.78421, "lng": 106.68715}', now()
  );



