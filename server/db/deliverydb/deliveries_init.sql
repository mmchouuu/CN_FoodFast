CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS drone_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address TEXT,
  district VARCHAR(50),       -- Quận
  ward VARCHAR(100),          -- Phường (tuỳ chọn)
  zone_name VARCHAR(100),     -- Zone nhỏ trong quận
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

CREATE TABLE IF NOT EXISTS drone_tracking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  drone_id UUID NOT NULL,
  delivery_id UUID,   

  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  battery INT,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  status VARCHAR(30),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_tracking_drone
    FOREIGN KEY (drone_id)
    REFERENCES drones(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_tracking_delivery  
    FOREIGN KEY (delivery_id)
    REFERENCES deliveries(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_drone_tracking_logs_drone_id_created_at
  ON drone_tracking_logs(drone_id, created_at DESC);
-- ============================================================
-- INSERT DRONE HUBS
-- ============================================================
INSERT INTO drone_hubs (id, name, address, district, ward, zone_name, location) VALUES
('00000000-0000-0000-0000-000000000001', 'District 1 – Hub A', 'Pasteur, D1', 'District 1', 'Ben Nghe', 'Pasteur Zone', '{"lat": 10.7791, "lng": 106.6987}'),
('00000000-0000-0000-0000-000000000002', 'District 1 – Hub B', 'Nguyen Hue, D1', 'District 1', 'Ben Thanh', 'Nguyen Hue Zone', '{"lat": 10.7764, "lng": 106.7002}'),
('00000000-0000-0000-0000-000000000003', 'District 1 – Hub C', 'Pham Ngu Lao, D1', 'District 1', 'P.Ng Lao', 'Backpacker Zone', '{"lat": 10.7695, "lng": 106.6935}'),
('00000000-0000-0000-0000-000000000004', 'District 2 – Hub A', 'Thao Dien, D2', 'District 2', 'Thao Dien', 'Thao Dien Zone', '{"lat": 10.8020, "lng": 106.7350}'),
('00000000-0000-0000-0000-000000000005', 'District 2 – Hub B', 'An Phu, D2', 'District 2', 'An Phu', 'An Phu Zone', '{"lat": 10.7980, "lng": 106.7480}'),
('00000000-0000-0000-0000-000000000006', 'District 2 – Hub C', 'Binh An, D2', 'District 2', 'Binh An', 'Binh An Zone', '{"lat": 10.7920, "lng": 106.7270}'),
('00000000-0000-0000-0000-000000000007', 'District 3 – Hub A', 'Vo Thi Sau, D3', 'District 3', 'Da Kao', 'VTS Zone', '{"lat": 10.7821, "lng": 106.6892}'),
('00000000-0000-0000-0000-000000000008', 'District 3 – Hub B', 'Ly Chinh Thang, D3', 'District 3', 'Ward 7', 'LCT Zone', '{"lat": 10.7829, "lng": 106.6844}'),
('00000000-0000-0000-0000-000000000009', 'District 3 – Hub C', 'Nam Ky Khoi Nghia, D3', 'District 3', 'Ward 6', 'NKK Zone', '{"lat": 10.7840, "lng": 106.6830}'),
('00000000-0000-0000-0000-000000000010', 'District 4 – Hub A', 'Vinh Khanh, D4', 'District 4', 'Ward 8', 'VK Zone', '{"lat": 10.7561, "lng": 106.7064}'),
('00000000-0000-0000-0000-000000000011', 'District 4 – Hub B', 'Hoang Dieu, D4', 'District 4', 'Ward 9', 'HD Zone', '{"lat": 10.7600, "lng": 106.7038}'),
('00000000-0000-0000-0000-000000000012', 'District 4 – Hub C', 'Ben Van Don, D4', 'District 4', 'Ward 12', 'BVD Zone', '{"lat": 10.7632, "lng": 106.7071}'),
('00000000-0000-0000-0000-000000000013', 'District 5 – Hub A', 'Tran Hung Dao, D5', 'District 5', 'Ward 1', 'THD Zone', '{"lat": 10.7540, "lng": 106.6650}'),
('00000000-0000-0000-0000-000000000014', 'District 5 – Hub B', 'Nguyen Trai, D5', 'District 5', 'Ward 7', 'NT Zone', '{"lat": 10.7567, "lng": 106.6673}'),
('00000000-0000-0000-0000-000000000015', 'District 5 – Hub C', 'Hai Thuong Lan Ong, D5', 'District 5', 'Ward 14', 'HTLO Zone', '{"lat": 10.7562, "lng": 106.6633}'),
('00000000-0000-0000-0000-000000000016', 'District 6 – Hub A', 'Au Co, D6', 'District 6', 'Ward 12', 'AC Zone', '{"lat": 10.7488, "lng": 106.6353}'),
('00000000-0000-0000-0000-000000000017', 'District 6 – Hub B', 'Tan Hoa Dong, D6', 'District 6', 'Ward 14', 'THD Zone', '{"lat": 10.7481, "lng": 106.6378}'),
('00000000-0000-0000-0000-000000000018', 'District 6 – Hub C', 'Hong Bang, D6', 'District 6', 'Ward 6', 'HB Zone', '{"lat": 10.7547, "lng": 106.6420}'),
('00000000-0000-0000-0000-000000000019', 'District 7 – Hub A', 'Phu My Hung, D7', 'District 7', 'Tan Phong', 'PMH Zone', '{"lat": 10.7291, "lng": 106.7199}'),
('00000000-0000-0000-0000-000000000020', 'District 7 – Hub B', 'Nguyen Thi Thap, D7', 'District 7', 'Tan Quy', 'NTT Zone', '{"lat": 10.7324, "lng": 106.7034}'),
('00000000-0000-0000-0000-000000000021', 'District 7 – Hub C', 'Nguyen Van Linh, D7', 'District 7', 'Tan Phu', 'NVL Zone', '{"lat": 10.7290, "lng": 106.7050}'),
('00000000-0000-0000-0000-000000000022', 'District 8 – Hub A', 'Ta Quang Buu, D8', 'District 8', 'Ward 5', 'TQB Zone', '{"lat": 10.7433, "lng": 106.6269}'),
('00000000-0000-0000-0000-000000000023', 'District 8 – Hub B', 'Pham The Hien, D8', 'District 8', 'Ward 7', 'PTH Zone', '{"lat": 10.7420, "lng": 106.6200}'),
('00000000-0000-0000-0000-000000000024', 'District 8 – Hub C', 'Duong Ba Trac, D8', 'District 8', 'Ward 1', 'DBT Zone', '{"lat": 10.7540, "lng": 106.6832}'),
('00000000-0000-0000-0000-000000000025', 'District 9 – Hub A', 'Tang Nhon Phu, D9', 'District 9', 'TNP A', 'TNP Zone', '{"lat": 10.8485, "lng": 106.8165}'),
('00000000-0000-0000-0000-000000000026', 'District 9 – Hub B', 'Le Van Viet, D9', 'District 9', 'HVH', 'LVV Zone', '{"lat": 10.8410, "lng": 106.8280}'),
('00000000-0000-0000-0000-000000000027', 'District 9 – Hub C', 'Do Xuan Hop, D9', 'District 9', 'Phuoc Long B', 'DXH Zone', '{"lat": 10.8195, "lng": 106.7765}'),
('00000000-0000-0000-0000-000000000028', 'District 10 – Hub A', 'Ba Thang Hai, D10', 'District 10', 'Ward 12', 'BTH Zone', '{"lat": 10.7743, "lng": 106.6689}'),
('00000000-0000-0000-0000-000000000029', 'District 10 – Hub B', 'Ly Thuong Kiet, D10', 'District 10', 'Ward 7', 'LTK Zone', '{"lat": 10.7765, "lng": 106.6613}'),
('00000000-0000-0000-0000-000000000030', 'District 10 – Hub C', 'Su Van Hanh, D10', 'District 10', 'Ward 5', 'SVH Zone', '{"lat": 10.7717, "lng": 106.6666}'),
('00000000-0000-0000-0000-000000000031', 'District 11 – Hub A', 'Le Dai Hanh, D11', 'District 11', 'Ward 3', 'LDH Zone', '{"lat": 10.7628, "lng": 106.6567}'),
('00000000-0000-0000-0000-000000000032', 'District 11 – Hub B', 'Ba Thang Hai, D11', 'District 11', 'Ward 5', 'BTH Zone', '{"lat": 10.7620, "lng": 106.6490}'),
('00000000-0000-0000-0000-000000000033', 'District 11 – Hub C', 'Au Co, D11', 'District 11', 'Ward 14', 'AC Zone', '{"lat": 10.7630, "lng": 106.6420}'),
('00000000-0000-0000-0000-000000000034', 'District 12 – Hub A', 'Quang Trung, D12', 'District 12', 'Ward 11', 'QT Zone', '{"lat": 10.8520, "lng": 106.6500}'),
('00000000-0000-0000-0000-000000000035', 'District 12 – Hub B', 'Le Van Khuong, D12', 'District 12', 'Thoi An', 'LVK Zone', '{"lat": 10.8810, "lng": 106.6580}'),
('00000000-0000-0000-0000-000000000036', 'District 12 – Hub C', 'Nguyen Anh Thu, D12', 'District 12', 'Hiep Thanh', 'NAT Zone', '{"lat": 10.8760, "lng": 106.6530}'),
('00000000-0000-0000-0000-000000000037', 'Binh Thanh – Hub A', 'Van Thanh, BT', 'Binh Thanh', 'Ward 22', 'Van Thanh Zone', '{"lat": 10.8015, "lng": 106.7135}'),
('00000000-0000-0000-0000-000000000038', 'Binh Thanh – Hub B', 'Xo Viet Nghe Tinh, BT', 'Binh Thanh', 'Ward 19', 'Xo Viet Zone', '{"lat": 10.7993, "lng": 106.7062}'),
('00000000-0000-0000-0000-000000000039', 'Binh Thanh – Hub C', 'Phan Dang Luu, BT', 'Binh Thanh', 'Ward 7', 'PDL Zone', '{"lat": 10.8040, "lng": 106.6860}'),
('00000000-0000-0000-0000-000000000040', 'Phu Nhuan – Hub A', 'Pham Van Hai, PN', 'Phu Nhuan', 'Ward 2', 'PVH Zone', '{"lat": 10.7942, "lng": 106.6701}'),
('00000000-0000-0000-0000-000000000041', 'Phu Nhuan – Hub B', 'Nguyen Kiem, PN', 'Phu Nhuan', 'Ward 4', 'NK Zone', '{"lat": 10.8001, "lng": 106.6762}'),
('00000000-0000-0000-0000-000000000042', 'Phu Nhuan – Hub C', 'Huynh Van Banh, PN', 'Phu Nhuan', 'Ward 11', 'HVB Zone', '{"lat": 10.7972, "lng": 106.6750}'),
('00000000-0000-0000-0000-000000000043', 'Tan Binh – Hub A', 'Le Van Sy, TB', 'Tan Binh', 'Ward 12', 'LVS Zone', '{"lat": 10.7975, "lng": 106.6660}'),
('00000000-0000-0000-0000-000000000044', 'Tan Binh – Hub B', 'Hoang Van Thu, TB', 'Tan Binh', 'Ward 4', 'HVT Zone', '{"lat": 10.8011, "lng": 106.6678}'),
('00000000-0000-0000-0000-000000000045', 'Tan Binh – Hub C', 'Pham Van Bach, TB', 'Tan Binh', 'Ward 15', 'PVB Zone', '{"lat": 10.8170, "lng": 106.6430}'),
('00000000-0000-0000-0000-000000000046', 'Binh Tan – Hub A', 'Kinh Duong Vuong, BTan', 'Binh Tan', 'An Lac', 'KDV Zone', '{"lat": 10.7405, "lng": 106.5901}'),
('00000000-0000-0000-0000-000000000047', 'Binh Tan – Hub B', 'Tinh Lo 10, BTan', 'Binh Tan', 'Tan Tao', 'TL10 Zone', '{"lat": 10.7620, "lng": 106.5965}'),
('00000000-0000-0000-0000-000000000048', 'Binh Tan – Hub C', 'Vo Van Kiet, BTan', 'Binh Tan', 'Binh Tri Dong', 'VVK Zone', '{"lat": 10.7520, "lng": 106.6030}'),
('00000000-0000-0000-0000-000000000049', 'Tan Phu – Hub A', 'Luy Ban Bich, TP', 'Tan Phu', 'Tan Thoi Hoa', 'LBB Zone', '{"lat": 10.7801, "lng": 106.6221}'),
('00000000-0000-0000-0000-000000000050', 'Tan Phu – Hub B', 'Truong Chinh, TP', 'Tan Phu', 'Tay Thanh', 'TC Zone', '{"lat": 10.8031, "lng": 106.6227}'),
('00000000-0000-0000-0000-000000000051', 'Tan Phu – Hub C', 'Au Co, TP', 'Tan Phu', 'Phu Trung', 'AC Zone', '{"lat": 10.7761, "lng": 106.6291}'),
('00000000-0000-0000-0000-000000000052', 'Binh Chanh – Hub A', 'Quoc Lo 50, BC', 'Binh Chanh', 'Phong Phu', 'QL50 Zone', '{"lat": 10.6820, "lng": 106.6031}'),
('00000000-0000-0000-0000-000000000053', 'Binh Chanh – Hub B', 'Nguyen Van Linh, BC', 'Binh Chanh', 'Binh Hung', 'NVL Zone', '{"lat": 10.7270, "lng": 106.6820}'),
('00000000-0000-0000-0000-000000000054', 'Binh Chanh – Hub C', 'Vinh Loc A, BC', 'Binh Chanh', 'Vinh Loc A', 'VLA Zone', '{"lat": 10.8355, "lng": 106.5742}');

-- ============================================================
-- INSERT DRONES (ĐÃ SỬA LỖI UUID)
-- ============================================================
INSERT INTO drones (
  code, model, max_payload, battery_level, status, hub_id, 
  image_url, last_known_position, last_active_at
) VALUES
-- DISTRICT 1 — HUB A
('DRONE-01', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000001', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7791, "lng": 106.6987}', now()),
('DRONE-02', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000001', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7791, "lng": 106.6987}', now()),
('DRONE-03', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000001', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7791, "lng": 106.6987}', now()),

-- DISTRICT 1 — HUB B
('DRONE-04', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000002', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7764, "lng": 106.7002}', now()),
('DRONE-05', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000002', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7764, "lng": 106.7002}', now()),
('DRONE-06', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000002', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7764, "lng": 106.7002}', now()),

-- DISTRICT 1 — HUB C
('DRONE-07', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000003', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7695, "lng": 106.6935}', now()),
('DRONE-08', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000003', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7695, "lng": 106.6935}', now()),
('DRONE-09', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000003', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7695, "lng": 106.6935}', now()),

-- DISTRICT 2 — HUB A
('DRONE-10', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000004', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8020, "lng": 106.7350}', now()),
('DRONE-11', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000004', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8020, "lng": 106.7350}', now()),
('DRONE-12', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000004', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8020, "lng": 106.7350}', now()),

-- DISTRICT 2 — HUB B
('DRONE-13', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000005', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7980, "lng": 106.7480}', now()),
('DRONE-14', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000005', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7980, "lng": 106.7480}', now()),
('DRONE-15', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000005', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7980, "lng": 106.7480}', now()),

-- DISTRICT 2 — HUB C
('DRONE-16', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000006', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7920, "lng": 106.7270}', now()),
('DRONE-17', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000006', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7920, "lng": 106.7270}', now()),
('DRONE-18', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000006', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7920, "lng": 106.7270}', now()),

-- DISTRICT 3 — HUB A
('DRONE-19', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000007', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7821, "lng": 106.6892}', now()),
('DRONE-20', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000007', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7821, "lng": 106.6892}', now()),
('DRONE-21', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000007', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7821, "lng": 106.6892}', now()),

-- DISTRICT 3 — HUB B (ĐÃ SỬA)
('DRONE-22', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000008', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7829, "lng": 106.6844}', now()),
('DRONE-23', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000008', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7829, "lng": 106.6844}', now()),
('DRONE-24', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000008', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7829, "lng": 106.6844}', now()),

-- DISTRICT 3 — HUB C
('DRONE-25', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000009', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7840, "lng": 106.6830}', now()),
('DRONE-26', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000009', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7840, "lng": 106.6830}', now()),
('DRONE-27', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000009', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7840, "lng": 106.6830}', now()),

-- DISTRICT 4 — HUB A (tiếp tục)
('DRONE-28', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000010', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7561, "lng": 106.7064}', now()),
('DRONE-29', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000010', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7561, "lng": 106.7064}', now()),
('DRONE-30', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000010', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7561, "lng": 106.7064}', now()),

-- DISTRICT 4 — HUB B
('DRONE-31', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000011', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7600, "lng": 106.7038}', now()),
('DRONE-32', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000011', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7600, "lng": 106.7038}', now()),
('DRONE-33', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000011', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7600, "lng": 106.7038}', now()),

-- DISTRICT 4 — HUB C
('DRONE-34', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000012', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7632, "lng": 106.7071}', now()),
('DRONE-35', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000012', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7632, "lng": 106.7071}', now()),
('DRONE-36', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000012', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7632, "lng": 106.7071}', now()),

-- DISTRICT 5 — HUB A
('DRONE-37', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000013', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7540, "lng": 106.6650}', now()),
('DRONE-38', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000013', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7540, "lng": 106.6650}', now()),
('DRONE-39', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000013', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7540, "lng": 106.6650}', now()),

-- DISTRICT 5 — HUB B
('DRONE-40', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000014', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7567, "lng": 106.6673}', now()),
('DRONE-41', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000014', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7567, "lng": 106.6673}', now()),
('DRONE-42', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000014', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7567, "lng": 106.6673}', now()),

-- DISTRICT 5 — HUB C
('DRONE-43', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000015', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7562, "lng": 106.6633}', now()),
('DRONE-44', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000015', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7562, "lng": 106.6633}', now()),
('DRONE-45', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000015', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7562, "lng": 106.6633}', now()),

-- DISTRICT 6 — HUB A
('DRONE-46', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000016', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7488, "lng": 106.6353}', now()),
('DRONE-47', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000016', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7488, "lng": 106.6353}', now()),
('DRONE-48', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000016', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7488, "lng": 106.6353}', now()),

-- DISTRICT 6 — HUB B
('DRONE-49', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000017', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7481, "lng": 106.6378}', now()),
('DRONE-50', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000017', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7481, "lng": 106.6378}', now()),
('DRONE-51', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000017', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7481, "lng": 106.6378}', now()),

-- DISTRICT 6 — HUB C
('DRONE-52', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000018', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7547, "lng": 106.6420}', now()),
('DRONE-53', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000018', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7547, "lng": 106.6420}', now()),
('DRONE-54', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000018', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7547, "lng": 106.6420}', now()),

-- DISTRICT 7 — HUB A
('DRONE-55', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000019', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7291, "lng": 106.7199}', now()),
('DRONE-56', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000019', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7291, "lng": 106.7199}', now()),
('DRONE-57', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000019', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7291, "lng": 106.7199}', now()),

-- DISTRICT 7 — HUB B
('DRONE-58', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000020', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7324, "lng": 106.7034}', now()),
('DRONE-59', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000020', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7324, "lng": 106.7034}', now()),
('DRONE-60', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000020', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7324, "lng": 106.7034}', now()),

-- DISTRICT 7 — HUB C
('DRONE-61', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000021', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7290, "lng": 106.7050}', now()),
('DRONE-62', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000021', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7290, "lng": 106.7050}', now()),
('DRONE-63', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000021', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7290, "lng": 106.7050}', now()),

-- DISTRICT 8 — HUB A
('DRONE-64', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000022', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7433, "lng": 106.6269}', now()),
('DRONE-65', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000022', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7433, "lng": 106.6269}', now()),
('DRONE-66', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000022', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7433, "lng": 106.6269}', now()),

-- DISTRICT 8 — HUB B
('DRONE-67', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000023', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7420, "lng": 106.6200}', now()),
('DRONE-68', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000023', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7420, "lng": 106.6200}', now()),
('DRONE-69', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000023', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7420, "lng": 106.6200}', now()),

-- DISTRICT 8 — HUB C
('DRONE-70', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000024', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7540, "lng": 106.6832}', now()),
('DRONE-71', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000024', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7540, "lng": 106.6832}', now()),
('DRONE-72', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000024', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7540, "lng": 106.6832}', now()),

-- DISTRICT 9 — HUB A
('DRONE-73', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000025', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8485, "lng": 106.8165}', now()),
('DRONE-74', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000025', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8485, "lng": 106.8165}', now()),
('DRONE-75', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000025', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8485, "lng": 106.8165}', now()),

-- DISTRICT 9 — HUB B
('DRONE-76', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000026', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8410, "lng": 106.8280}', now()),
('DRONE-77', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000026', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8410, "lng": 106.8280}', now()),
('DRONE-78', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000026', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8410, "lng": 106.8280}', now()),

-- DISTRICT 9 — HUB C
('DRONE-79', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000027', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8195, "lng": 106.7765}', now()),
('DRONE-80', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000027', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8195, "lng": 106.7765}', now()),
('DRONE-81', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000027', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8195, "lng": 106.7765}', now()),

-- DISTRICT 10 — HUB A
('DRONE-82', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000028', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7743, "lng": 106.6689}', now()),
('DRONE-83', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000028', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7743, "lng": 106.6689}', now()),
('DRONE-84', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000028', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7743, "lng": 106.6689}', now()),

-- DISTRICT 10 — HUB B
('DRONE-85', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000029', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7765, "lng": 106.6613}', now()),
('DRONE-86', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000029', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7765, "lng": 106.6613}', now()),
('DRONE-87', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000029', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7765, "lng": 106.6613}', now()),

-- DISTRICT 10 — HUB C
('DRONE-88', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000030', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7717, "lng": 106.6666}', now()),
('DRONE-89', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000030', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7717, "lng": 106.6666}', now()),
('DRONE-90', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000030', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7717, "lng": 106.6666}', now()),

-- DISTRICT 11 — HUB A (tiếp tục)
('DRONE-91', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000031', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7628, "lng": 106.6567}', now()),
('DRONE-92', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000031', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7628, "lng": 106.6567}', now()),
('DRONE-93', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000031', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7628, "lng": 106.6567}', now()),

-- DISTRICT 11 — HUB B
('DRONE-94', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000032', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7620, "lng": 106.6490}', now()),
('DRONE-95', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000032', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7620, "lng": 106.6490}', now()),
('DRONE-96', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000032', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7620, "lng": 106.6490}', now()),

-- DISTRICT 11 — HUB C
('DRONE-97', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000033', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7630, "lng": 106.6420}', now()),
('DRONE-98', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000033', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7630, "lng": 106.6420}', now()),
('DRONE-99', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000033', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7630, "lng": 106.6420}', now()),

-- DISTRICT 12 — HUB A
('DRONE-100', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000034', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8520, "lng": 106.6500}', now()),
('DRONE-101', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000034', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8520, "lng": 106.6500}', now()),
('DRONE-102', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000034', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8520, "lng": 106.6500}', now()),

-- DISTRICT 12 — HUB B
('DRONE-103', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000035', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8810, "lng": 106.6580}', now()),
('DRONE-104', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000035', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8810, "lng": 106.6580}', now()),
('DRONE-105', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000035', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8810, "lng": 106.6580}', now()),

-- DISTRICT 12 — HUB C
('DRONE-106', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000036', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8760, "lng": 106.6530}', now()),
('DRONE-107', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000036', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8760, "lng": 106.6530}', now()),
('DRONE-108', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000036', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8760, "lng": 106.6530}', now()),

-- BINH THANH — HUB A (ĐÃ SỬA)
('DRONE-109', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000037', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8015, "lng": 106.7135}', now()),
('DRONE-110', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000037', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8015, "lng": 106.7135}', now()),
('DRONE-111', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000037', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8015, "lng": 106.7135}', now()),

-- BINH THANH — HUB B (ĐÃ SỬA)
('DRONE-112', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000038', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7993, "lng": 106.7062}', now()),
('DRONE-113', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000038', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7993, "lng": 106.7062}', now()),
('DRONE-114', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000038', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7993, "lng": 106.7062}', now()),

-- BINH THANH — HUB C (ĐÃ SỬA)
('DRONE-115', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000039', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8040, "lng": 106.6860}', now()),
('DRONE-116', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000039', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8040, "lng": 106.6860}', now()),
('DRONE-117', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000039', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8040, "lng": 106.6860}', now()),

-- PHU NHUAN — HUB A (ĐÃ SỬA)
('DRONE-118', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000040', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7942, "lng": 106.6701}', now()),
('DRONE-119', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000040', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7942, "lng": 106.6701}', now()),
('DRONE-120', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000040', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7942, "lng": 106.6701}', now()),

-- PHU NHUAN — HUB B (ĐÃ SỬA)
('DRONE-121', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000041', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8001, "lng": 106.6762}', now()),
('DRONE-122', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000041', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8001, "lng": 106.6762}', now()),
('DRONE-123', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000041', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8001, "lng": 106.6762}', now()),

-- PHU NHUAN — HUB C (ĐÃ SỬA)
('DRONE-124', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000042', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7972, "lng": 106.6750}', now()),
('DRONE-125', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000042', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7972, "lng": 106.6750}', now()),
('DRONE-126', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000042', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7972, "lng": 106.6750}', now()),

-- TAN BINH — HUB A (ĐÃ SỬA)
('DRONE-127', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000043', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7975, "lng": 106.6660}', now()),
('DRONE-128', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000043', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7975, "lng": 106.6660}', now()),
('DRONE-129', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000043', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7975, "lng": 106.6660}', now()),

-- TAN BINH — HUB B (ĐÃ SỬA)
('DRONE-130', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000044', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8011, "lng": 106.6678}', now()),
('DRONE-131', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000044', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8011, "lng": 106.6678}', now()),
('DRONE-132', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000044', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8011, "lng": 106.6678}', now()),

-- TAN BINH — HUB C (ĐÃ SỬA)
('DRONE-133', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000045', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8170, "lng": 106.6430}', now()),
('DRONE-134', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000045', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8170, "lng": 106.6430}', now()),
('DRONE-135', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000045', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8170, "lng": 106.6430}', now()),

-- BINH TAN — HUB A (ĐÃ SỬA)
('DRONE-136', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000046', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7405, "lng": 106.5901}', now()),
('DRONE-137', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000046', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7405, "lng": 106.5901}', now()),
('DRONE-138', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000046', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7405, "lng": 106.5901}', now()),

-- BINH TAN — HUB B (ĐÃ SỬA)
('DRONE-139', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000047', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7620, "lng": 106.5965}', now()),
('DRONE-140', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000047', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7620, "lng": 106.5965}', now()),
('DRONE-141', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000047', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7620, "lng": 106.5965}', now()),

-- BINH TAN — HUB C (ĐÃ SỬA)
('DRONE-142', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000048', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7520, "lng": 106.6030}', now()),
('DRONE-143', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000048', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7520, "lng": 106.6030}', now()),
('DRONE-144', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000048', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7520, "lng": 106.6030}', now()),

-- TAN PHU — HUB A (ĐÃ SỬA)
('DRONE-145', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000049', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7801, "lng": 106.6221}', now()),
('DRONE-146', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000049', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7801, "lng": 106.6221}', now()),
('DRONE-147', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000049', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7801, "lng": 106.6221}', now()),

-- TAN PHU — HUB B (ĐÃ SỬA)
('DRONE-148', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000050', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8031, "lng": 106.6227}', now()),
('DRONE-149', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000050', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8031, "lng": 106.6227}', now()),
('DRONE-150', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000050', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8031, "lng": 106.6227}', now()),

-- TAN PHU — HUB C (ĐÃ SỬA)
('DRONE-151', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000051', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7761, "lng": 106.6291}', now()),
('DRONE-152', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000051', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7761, "lng": 106.6291}', now()),
('DRONE-153', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000051', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7761, "lng": 106.6291}', now()),

-- BINH CHANH — HUB A (ĐÃ SỬA)
('DRONE-154', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000052', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.6820, "lng": 106.6031}', now()),
('DRONE-155', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000052', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.6820, "lng": 106.6031}', now()),
('DRONE-156', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000052', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.6820, "lng": 106.6031}', now()),

-- BINH CHANH — HUB B (ĐÃ SỬA)
('DRONE-157', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000053', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.7270, "lng": 106.6820}', now()),
('DRONE-158', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000053', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.7270, "lng": 106.6820}', now()),
('DRONE-159', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000053', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.7270, "lng": 106.6820}', now()),

-- BINH CHANH — HUB C (ĐÃ SỬA - DRONE CUỐI CÙNG)
('DRONE-160', 'DJI Mavic Air 2', 2.00, 100, 'idle', '00000000-0000-0000-0000-000000000054', 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png', '{"lat": 10.8355, "lng": 106.5742}', now()),
('DRONE-161', 'DJI Mini Pro 3', 1.50, 100, 'idle', '00000000-0000-0000-0000-000000000054', 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png', '{"lat": 10.8355, "lng": 106.5742}', now()),
('DRONE-162', 'DJI Matrice 30', 3.50, 100, 'idle', '00000000-0000-0000-0000-000000000054', 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg', '{"lat": 10.8355, "lng": 106.5742}', now());

-- Sample deliveries for admin tracking
INSERT INTO deliveries (
  id, order_id, branch_id, provider_type, drone_id, delivery_address, branch_location,
  route, distance_meters, estimated_time_sec, current_position, progress_percent,
  delivery_status, pickup_at, created_at
) VALUES
('50111111-1111-4111-8111-000000000001','60111111-1111-4111-8111-000000000001','70111111-1111-4111-8111-000000000001','drone',
 (SELECT id FROM drones WHERE code = 'DRONE-05' LIMIT 1),
 '{"address": "221 Nguyen Thi Minh Khai, District 3"}','{"lat": 10.7764, "lng": 106.7002}',
 '{"polyline": [], "waypoints": []}', 3200, 900, '{"lat": 10.7804, "lng": 106.6987}', 62, 'flying', now() - interval '8 minutes', now() - interval '10 minutes'),
('50111111-1111-4111-8111-000000000002','60111111-1111-4111-8111-000000000002','70111111-1111-4111-8111-000000000002','drone',
 (SELECT id FROM drones WHERE code = 'DRONE-08' LIMIT 1),
 '{"address": "12 Street 2, Thu Duc City"}','{"lat": 10.7821, "lng": 106.6892}',
 '{"polyline": [], "waypoints": []}', 5100, 1200, '{"lat": 10.78144, "lng": 106.68897}', 91, 'arriving', now() - interval '12 minutes', now() - interval '15 minutes'),
('50111111-1111-4111-8111-000000000003','60111111-1111-4111-8111-000000000003','70111111-1111-4111-8111-000000000003','drone',
 (SELECT id FROM drones WHERE code = 'DRONE-02' LIMIT 1),
 '{"address": "88 Vo Thi Sau, District 3"}','{"lat": 10.7791, "lng": 106.6987}',
 '{"polyline": [], "waypoints": []}', 2800, 840, '{"lat": 10.7879, "lng": 106.7012}', 40, 'assigned', NULL, now() - interval '5 minutes')
ON CONFLICT (id) DO NOTHING;

