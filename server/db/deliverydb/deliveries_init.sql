CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CREATE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS drone_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address TEXT,
  district VARCHAR(50),
  ward VARCHAR(100),
  zone_name VARCHAR(100),
  location JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  model VARCHAR(100),
  max_payload NUMERIC(6,2),
  battery_level INT DEFAULT 100,
  status VARCHAR(20) NOT NULL DEFAULT 'idle'
    CHECK (
      status IN (
        'idle',
        'assigned',
        'flying',
        'charging',
        'maintenance',
        'offline',
        'to_restaurant',
        'to_customer',
        'returning',
        'landed'
      )
    ),
  hub_id UUID REFERENCES drone_hubs(id),
  image_url TEXT,
  last_known_position JSONB,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);



CREATE TABLE IF NOT EXISTS drone_hub_assignments (
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
      'pending',
      'assigned',
      'to_restaurant',
      'to_customer',
      'returning',
      'flying',
      'arriving',
      'completed',
      'failed',
      'cancelled'
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

-- Ensure updated status constraints on existing databases
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'drones_status_check'
      AND table_name = 'drones'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE drones DROP CONSTRAINT drones_status_check;
  END IF;
  ALTER TABLE drones
    ADD CONSTRAINT drones_status_check CHECK (
      status IN (
        'idle',
        'assigned',
        'flying',
        'charging',
        'maintenance',
        'offline',
        'to_restaurant',
        'to_customer',
        'returning',
        'landed'
      )
    );

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'deliveries_delivery_status_check'
      AND table_name = 'deliveries'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE deliveries DROP CONSTRAINT deliveries_delivery_status_check;
  END IF;
  ALTER TABLE deliveries
    ADD CONSTRAINT deliveries_delivery_status_check CHECK (
      delivery_status IN (
        'pending',
        'assigned',
        'to_restaurant',
        'to_customer',
        'returning',
        'flying',
        'arriving',
        'completed',
        'failed',
        'cancelled'
      )
    );
END;
$$;

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
-- INSERT DRONE HUBS (ĐÃ SỬA: street → address, zone → zone_name)
-- ============================================================

INSERT INTO drone_hubs (id, name, address, district, ward, zone_name, location) VALUES
-- DISTRICT 1
('00000000-0000-0000-0000-000000000001', 'District 1 – Hub A', '143 Pasteur, Ben Nghe', 'District 1', 'Ben Nghe', 'Pasteur Zone', '{"lat": 10.779550, "lng": 106.699355}'),
('00000000-0000-0000-0000-000000000002', 'District 1 – Hub B', '7 Nguyen Hue, Ben Nghe', 'District 1', 'Ben Nghe', 'Nguyen Hue Zone', '{"lat": 10.773170, "lng": 106.704597}'),
('00000000-0000-0000-0000-000000000003', 'District 1 – Hub C', '185 Pham Ngu Lao', 'District 1', 'Pham Ngu Lao', 'Backpacker Zone', '{"lat": 10.768326, "lng": 106.692245}'),

-- DISTRICT 2
('00000000-0000-0000-0000-000000000004', 'District 2 – Hub A', '23 Thao Dien', 'District 2', 'Thao Dien', 'Thao Dien Zone', '{"lat": 10.803630, "lng": 106.732430}'),
('00000000-0000-0000-0000-000000000005', 'District 2 – Hub B', '120 Nguyen Hoang, An Phu', 'District 2', 'An Phu', 'An Phu Zone', '{"lat": 10.800530, "lng": 106.749870}'),
('00000000-0000-0000-0000-000000000006', 'District 2 – Hub C', '45 Tran Nao, Binh An', 'District 2', 'Binh An', 'Binh An Zone', '{"lat": 10.791500, "lng": 106.729700}'),

-- DISTRICT 3
('00000000-0000-0000-0000-000000000007', 'District 3 – Hub A', '73 Vo Thi Sau, Da Kao', 'District 3', 'Da Kao', 'VTS Zone', '{"lat": 10.787650, "lng": 106.696100}'),
('00000000-0000-0000-0000-000000000008', 'District 3 – Hub B', '95 Ly Chinh Thang', 'District 3', 'Ward 7', 'LCT Zone', '{"lat": 10.784850, "lng": 106.684070}'),
('00000000-0000-0000-0000-000000000009', 'District 3 – Hub C', '339 Nam Ky Khoi Nghia', 'District 3', 'Ward 7', 'NKK Zone', '{"lat": 10.784900, "lng": 106.688000}'),

-- DISTRICT 4
('00000000-0000-0000-0000-000000000010', 'District 4 – Hub A', '126 Vinh Khanh, Ward 8', 'District 4', 'Ward 8', 'VK Zone', '{"lat": 10.756150, "lng": 106.706420}'),
('00000000-0000-0000-0000-000000000011', 'District 4 – Hub B', '120 Hoang Dieu, Ward 9', 'District 4', 'Ward 9', 'HD Zone', '{"lat": 10.760030, "lng": 106.703880}'),
('00000000-0000-0000-0000-000000000012', 'District 4 – Hub C', '360 Ben Van Don, Ward 12', 'District 4', 'Ward 12', 'BVD Zone', '{"lat": 10.763230, "lng": 106.707130}'),

-- DISTRICT 5
('00000000-0000-0000-0000-000000000013', 'District 5 – Hub A', '84 Tran Hung Dao, Ward 1', 'District 5', 'Ward 1', 'THD Zone', '{"lat": 10.754020, "lng": 106.665080}'),
('00000000-0000-0000-0000-000000000014', 'District 5 – Hub B', '720 Nguyen Trai, Ward 7', 'District 5', 'Ward 7', 'NT Zone', '{"lat": 10.756740, "lng": 106.667360}'),
('00000000-0000-0000-0000-000000000015', 'District 5 – Hub C', '378 Hai Thuong Lan Ong, Ward 14', 'District 5', 'Ward 14', 'HTLO Zone', '{"lat": 10.756210, "lng": 106.663270}'),

-- DISTRICT 6
('00000000-0000-0000-0000-000000000016', 'District 6 – Hub A', '120 Au Co, Ward 12', 'District 6', 'Ward 12', 'AC Zone', '{"lat": 10.748800, "lng": 106.635300}'),
('00000000-0000-0000-0000-000000000017', 'District 6 – Hub B', '650 Tan Hoa Dong, Ward 14', 'District 6', 'Ward 14', 'THD Zone', '{"lat": 10.748120, "lng": 106.637820}'),
('00000000-0000-0000-0000-000000000018', 'District 6 – Hub C', '450 Hong Bang, Ward 6', 'District 6', 'Ward 6', 'HB Zone', '{"lat": 10.754700, "lng": 106.642000}'),

-- DISTRICT 7
('00000000-0000-0000-0000-000000000019', 'District 7 – Hub A', '801 Nguyen Van Linh, Tan Phong', 'District 7', 'Tan Phong', 'PMH Zone', '{"lat": 10.729100, "lng": 106.719900}'),
('00000000-0000-0000-0000-000000000020', 'District 7 – Hub B', '672 Nguyen Thi Thap, Tan Quy', 'District 7', 'Tan Quy', 'NTT Zone', '{"lat": 10.732400, "lng": 106.703400}'),
('00000000-0000-0000-0000-000000000021', 'District 7 – Hub C', '45 Nguyen Van Linh, Tan Phu', 'District 7', 'Tan Phu', 'NVL Zone', '{"lat": 10.729000, "lng": 106.705000}'),

-- DISTRICT 8
('00000000-0000-0000-0000-000000000022', 'District 8 – Hub A', '326 Ta Quang Buu, Ward 5', 'District 8', 'Ward 5', 'TQB Zone', '{"lat": 10.743300, "lng": 106.626900}'),
('00000000-0000-0000-0000-000000000023', 'District 8 – Hub B', '1040 Pham The Hien, Ward 7', 'District 8', 'Ward 7', 'PTH Zone', '{"lat": 10.742000, "lng": 106.620000}'),
('00000000-0000-0000-0000-000000000024', 'District 8 – Hub C', '140 Duong Ba Trac, Ward 1', 'District 8', 'Ward 1', 'DBT Zone', '{"lat": 10.754000, "lng": 106.683200}'),

-- DISTRICT 9
('00000000-0000-0000-0000-000000000025', 'District 9 – Hub A', '120 Tang Nhon Phu B, TNP A', 'District 9', 'TNP A', 'TNP Zone', '{"lat": 10.848500, "lng": 106.816500}'),
('00000000-0000-0000-0000-000000000026', 'District 9 – Hub B', '56 Le Van Viet, Hiep Phu', 'District 9', 'HVH', 'LVV Zone', '{"lat": 10.841000, "lng": 106.828000}'),
('00000000-0000-0000-0000-000000000027', 'District 9 – Hub C', '215 Do Xuan Hop, Phuoc Long B', 'District 9', 'Phuoc Long B', 'DXH Zone', '{"lat": 10.819500, "lng": 106.776500}'),

-- DISTRICT 10
('00000000-0000-0000-0000-000000000028', 'District 10 – Hub A', '285 Ba Thang Hai, Ward 12', 'District 10', 'Ward 12', 'BTH Zone', '{"lat": 10.774300, "lng": 106.668900}'),
('00000000-0000-0000-0000-000000000029', 'District 10 – Hub B', '324 Ly Thuong Kiet, Ward 7', 'District 10', 'Ward 7', 'LTK Zone', '{"lat": 10.776500, "lng": 106.661300}'),
('00000000-0000-0000-0000-000000000030', 'District 10 – Hub C', '716 Su Van Hanh, Ward 5', 'District 10', 'Ward 5', 'SVH Zone', '{"lat": 10.771700, "lng": 106.666600}'),

-- DISTRICT 11
('00000000-0000-0000-0000-000000000031', 'District 11 – Hub A', '52 Le Dai Hanh, Ward 3', 'District 11', 'Ward 3', 'LDH Zone', '{"lat": 10.762800, "lng": 106.656700}'),
('00000000-0000-0000-0000-000000000032', 'District 11 – Hub B', '294 Ba Thang Hai, Ward 5', 'District 11', 'Ward 5', 'BTH Zone', '{"lat": 10.762000, "lng": 106.649000}'),
('00000000-0000-0000-0000-000000000033', 'District 11 – Hub C', '1021 Au Co, Ward 14', 'District 11', 'Ward 14', 'AC Zone', '{"lat": 10.763000, "lng": 106.642000}'),

-- DISTRICT 12
('00000000-0000-0000-0000-000000000034', 'District 12 – Hub A', '280 Quang Trung, Ward 11', 'District 12', 'Ward 11', 'QT Zone', '{"lat": 10.852000, "lng": 106.650000}'),
('00000000-0000-0000-0000-000000000035', 'District 12 – Hub B', '63 Le Van Khuong, Thoi An', 'District 12', 'Thoi An', 'LVK Zone', '{"lat": 10.881000, "lng": 106.658000}'),
('00000000-0000-0000-0000-000000000036', 'District 12 – Hub C', '40 Nguyen Anh Thu, Hiep Thanh', 'District 12', 'Hiep Thanh', 'NAT Zone', '{"lat": 10.876000, "lng": 106.653000}'),

-- BINH THANH
('00000000-0000-0000-0000-000000000037', 'Binh Thanh – Hub A', '25 Van Thanh, Ward 22', 'Binh Thanh', 'Ward 22', 'Van Thanh Zone', '{"lat": 10.801500, "lng": 106.713500}'),
('00000000-0000-0000-0000-000000000038', 'Binh Thanh – Hub B', '180 Xo Viet Nghe Tinh, Ward 19', 'Binh Thanh', 'Ward 19', 'Xo Viet Zone', '{"lat": 10.799300, "lng": 106.706200}'),
('00000000-0000-0000-0000-000000000039', 'Binh Thanh – Hub C', '368 Phan Dang Luu, Ward 7', 'Binh Thanh', 'Ward 7', 'PDL Zone', '{"lat": 10.804000, "lng": 106.686000}'),

-- PHU NHUAN
('00000000-0000-0000-0000-000000000040', 'Phu Nhuan – Hub A', '61 Pham Van Hai, Ward 2', 'Phu Nhuan', 'Ward 2', 'PVH Zone', '{"lat": 10.794200, "lng": 106.670100}'),
('00000000-0000-0000-0000-000000000041', 'Phu Nhuan – Hub B', '317 Nguyen Kiem, Ward 4', 'Phu Nhuan', 'Ward 4', 'NK Zone', '{"lat": 10.800100, "lng": 106.676200}'),
('00000000-0000-0000-0000-000000000042', 'Phu Nhuan – Hub C', '111 Huynh Van Banh, Ward 11', 'Phu Nhuan', 'Ward 11', 'HVB Zone', '{"lat": 10.797200, "lng": 106.675000}'),

-- TAN BINH
('00000000-0000-0000-0000-000000000043', 'Tan Binh – Hub A', '233 Le Van Sy, Ward 12', 'Tan Binh', 'Ward 12', 'LVS Zone', '{"lat": 10.797500, "lng": 106.666000}'),
('00000000-0000-0000-0000-000000000044', 'Tan Binh – Hub B', '191 Hoang Van Thu, Ward 4', 'Tan Binh', 'Ward 4', 'HVT Zone', '{"lat": 10.801100, "lng": 106.667800}'),
('00000000-0000-0000-0000-000000000045', 'Tan Binh – Hub C', '142 Pham Van Bach, Ward 15', 'Tan Binh', 'Ward 15', 'PVB Zone', '{"lat": 10.817000, "lng": 106.643000}'),

-- BINH TAN
('00000000-0000-0000-0000-000000000046', 'Binh Tan – Hub A', '98 Kinh Duong Vuong, An Lac', 'Binh Tan', 'An Lac', 'KDV Zone', '{"lat": 10.740500, "lng": 106.590100}'),
('00000000-0000-0000-0000-000000000047', 'Binh Tan – Hub B', '765 Tinh Lo 10, Tan Tao', 'Binh Tan', 'Tan Tao', 'TL10 Zone', '{"lat": 10.762000, "lng": 106.596500}'),
('00000000-0000-0000-0000-000000000048', 'Binh Tan – Hub C', '120 Vo Van Kiet, Binh Tri Dong', 'Binh Tan', 'Binh Tri Dong', 'VVK Zone', '{"lat": 10.752000, "lng": 106.603000}'),

-- TAN PHU
('00000000-0000-0000-0000-000000000049', 'Tan Phu – Hub A', '55 Luy Ban Bich, Tan Thoi Hoa', 'Tan Phu', 'Tan Thoi Hoa', 'LBB Zone', '{"lat": 10.780100, "lng": 106.622100}'),
('00000000-0000-0000-0000-000000000050', 'Tan Phu – Hub B', '120 Truong Chinh, Tay Thanh', 'Tan Phu', 'Tay Thanh', 'TC Zone', '{"lat": 10.803100, "lng": 106.622700}'),
('00000000-0000-0000-0000-000000000051', 'Tan Phu – Hub C', '45 Au Co, Phu Trung', 'Tan Phu', 'Phu Trung', 'AC Zone', '{"lat": 10.776100, "lng": 106.629100}'),

-- BINH CHANH
('00000000-0000-0000-0000-000000000052', 'Binh Chanh – Hub A', '325 Quoc Lo 50, Phong Phu', 'Binh Chanh', 'Phong Phu', 'QL50 Zone', '{"lat": 10.682000, "lng": 106.603100}'),
('00000000-0000-0000-0000-000000000053', 'Binh Chanh – Hub B', '9 Nguyen Van Linh, Binh Hung', 'Binh Chanh', 'Binh Hung', 'NVL Zone', '{"lat": 10.727000, "lng": 106.682000}'),
('00000000-0000-0000-0000-000000000054', 'Binh Chanh – Hub C', '22 Vinh Loc A, Vinh Loc A', 'Binh Chanh', 'Vinh Loc A', 'VLA Zone', '{"lat": 10.835500, "lng": 106.574200}');


-- ============================================================
-- INSERT DRONES (ĐÃ SỬA LỖI UUID)
-- ============================================================
INSERT INTO drones (
  code, model, max_payload, battery_level, status, hub_id, 
  image_url, last_known_position, last_active_at
) VALUES

-- ================================
-- DISTRICT 1 — HUB A (ID: 00000000-0000-0000-0000-000000000001)
-- ================================
('DRONE-01', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000001',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7791, "lng": 106.6987}', now()),

('DRONE-02', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000001',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7791, "lng": 106.6987}', now()),

('DRONE-03', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000001',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7791, "lng": 106.6987}', now()),


-- ================================
-- DISTRICT 1 — HUB B (ID: 00000000-0000-0000-0000-000000000002)
-- ================================
('DRONE-04', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000002',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7764, "lng": 106.7002}', now()),

('DRONE-05', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000002',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7764, "lng": 106.7002}', now()),

('DRONE-06', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000002',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7764, "lng": 106.7002}', now()),


-- ================================
-- DISTRICT 1 — HUB C (ID: 00000000-0000-0000-0000-000000000003)
-- ================================
('DRONE-07', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000003',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7695, "lng": 106.6935}', now()),

('DRONE-08', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000003',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7695, "lng": 106.6935}', now()),

('DRONE-09', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000003',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7695, "lng": 106.6935}', now()),


-- ================================
-- DISTRICT 2 — HUB A (ID: 00000000-0000-0000-0000-000000000004)
-- ================================
('DRONE-10', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000004',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8020, "lng": 106.7350}', now()),

('DRONE-11', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000004',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8020, "lng": 106.7350}', now()),

('DRONE-12', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000004',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8020, "lng": 106.7350}', now()),


-- ================================
-- DISTRICT 2 — HUB B (ID: 00000000-0000-0000-0000-000000000005)
-- ================================
('DRONE-13', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000005',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7980, "lng": 106.7480}', now()),

('DRONE-14', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000005',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7980, "lng": 106.7480}', now()),

('DRONE-15', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000005',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7980, "lng": 106.7480}', now()),


-- ================================
-- DISTRICT 2 — HUB C (ID: 00000000-0000-0000-0000-000000000006)
-- ================================
('DRONE-16', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000006',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7920, "lng": 106.7270}', now()),

('DRONE-17', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000006',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7920, "lng": 106.7270}', now()),

('DRONE-18', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000006',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7920, "lng": 106.7270}', now()),


-- ============================================
-- DISTRICT 3 — HUB A (ID: 00000000-0000-0000-0000-000000000007)
-- ============================================
('DRONE-19', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000007',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7821, "lng": 106.6892}', now()),

('DRONE-20', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000007',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7821, "lng": 106.6892}', now()),

('DRONE-21', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000007',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7821, "lng": 106.6892}', now()),


-- ============================================
-- DISTRICT 3 — HUB B (ID: 00000000-0000-0000-0000-000000000008)
-- ============================================
('DRONE-22', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000008',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7829, "lng": 106.6844}', now()),

('DRONE-23', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000008',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7829, "lng": 106.6844}', now()),

('DRONE-24', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000008',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7829, "lng": 106.6844}', now()),


-- ============================================
-- DISTRICT 3 — HUB C (ID: 00000000-0000-0000-0000-000000000009)
-- ============================================
('DRONE-25', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000009',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7840, "lng": 106.6830}', now()),

('DRONE-26', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000009',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7840, "lng": 106.6830}', now()),

('DRONE-27', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000009',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7840, "lng": 106.6830}', now()),


-- ============================================
-- DISTRICT 4 — HUB A (ID: 00000000-0000-0000-0000-000000000010)
-- ============================================
('DRONE-28', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000010',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7561, "lng": 106.7064}', now()),

('DRONE-29', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000010',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7561, "lng": 106.7064}', now()),

('DRONE-30', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000010',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7561, "lng": 106.7064}', now()),


-- ============================================
-- DISTRICT 4 — HUB B (ID: 00000000-0000-0000-0000-000000000011)
-- ============================================
('DRONE-31', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000011',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7600, "lng": 106.7038}', now()),

('DRONE-32', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000011',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7600, "lng": 106.7038}', now()),

('DRONE-33', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000011',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7600, "lng": 106.7038}', now()),


-- ============================================
-- DISTRICT 4 — HUB C (ID: 00000000-0000-0000-0000-000000000012)
-- ============================================
('DRONE-34', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000012',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7632, "lng": 106.7071}', now()),

('DRONE-35', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000012',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7632, "lng": 106.7071}', now()),

('DRONE-36', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000012',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7632, "lng": 106.7071}', now()),


-- ============================================
-- DISTRICT 5 — HUB A (ID: 00000000-0000-0000-0000-000000000013)
-- ============================================
('DRONE-37', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000013',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7540, "lng": 106.6650}', now()),

('DRONE-38', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000013',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7540, "lng": 106.6650}', now()),

('DRONE-39', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000013',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7540, "lng": 106.6650}', now()),


-- ============================================
-- DISTRICT 5 — HUB B (ID: 00000000-0000-0000-0000-000000000014)
-- ============================================
('DRONE-40', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000014',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7567, "lng": 106.6673}', now()),

('DRONE-41', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000014',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7567, "lng": 106.6673}', now()),

('DRONE-42', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000014',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7567, "lng": 106.6673}', now()),


-- ============================================
-- DISTRICT 5 — HUB C (ID: 00000000-0000-0000-0000-000000000015)
-- ============================================
('DRONE-43', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000015',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7562, "lng": 106.6633}', now()),

('DRONE-44', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000015',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7562, "lng": 106.6633}', now()),

('DRONE-45', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000015',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7562, "lng": 106.6633}', now()),


-- ============================================
-- DISTRICT 6 — HUB A (ID: 00000000-0000-0000-0000-000000000016)
-- ============================================
('DRONE-46', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000016',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7488, "lng": 106.6353}', now()),

('DRONE-47', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000016',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7488, "lng": 106.6353}', now()),

('DRONE-48', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000016',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7488, "lng": 106.6353}', now()),


-- ============================================
-- DISTRICT 6 — HUB B (ID: 00000000-0000-0000-0000-000000000017)
-- ============================================
('DRONE-49', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000017',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7481, "lng": 106.6378}', now()),

('DRONE-50', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000017',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7481, "lng": 106.6378}', now()),

('DRONE-51', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000017',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7481, "lng": 106.6378}', now()),


-- ============================================
-- DISTRICT 6 — HUB C (ID: 00000000-0000-0000-0000-000000000018)
-- ============================================
('DRONE-52', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000018',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7547, "lng": 106.6420}', now()),

('DRONE-53', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000018',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7547, "lng": 106.6420}', now()),

('DRONE-54', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000018',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7547, "lng": 106.6420}', now()),


-- ============================================
-- DISTRICT 7 — HUB A (ID: 00000000-0000-0000-0000-000000000019)
-- ============================================
('DRONE-55', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000019',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7291, "lng": 106.7199}', now()),

('DRONE-56', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000019',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7291, "lng": 106.7199}', now()),

('DRONE-57', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000019',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7291, "lng": 106.7199}', now()),


-- ============================================
-- DISTRICT 7 — HUB B (ID: 00000000-0000-0000-0000-000000000020)
-- ============================================
('DRONE-58', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000020',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7324, "lng": 106.7034}', now()),

('DRONE-59', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000020',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7324, "lng": 106.7034}', now()),

('DRONE-60', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000020',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7324, "lng": 106.7034}', now()),


-- ============================================
-- DISTRICT 7 — HUB C (ID: 00000000-0000-0000-0000-000000000021)
-- ============================================
('DRONE-61', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000021',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7290, "lng": 106.7050}', now()),

('DRONE-62', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000021',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7290, "lng": 106.7050}', now()),

('DRONE-63', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000021',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7290, "lng": 106.7050}', now()),


-- ============================================
-- DISTRICT 8 — HUB A (ID: 00000000-0000-0000-0000-000000000022)
-- ============================================
('DRONE-64', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000022',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7433, "lng": 106.6269}', now()),

('DRONE-65', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000022',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7433, "lng": 106.6269}', now()),

('DRONE-66', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000022',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7433, "lng": 106.6269}', now()),


-- ============================================
-- DISTRICT 8 — HUB B (ID: 00000000-0000-0000-0000-000000000023)
-- ============================================
('DRONE-67', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000023',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7420, "lng": 106.6200}', now()),

('DRONE-68', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000023',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7420, "lng": 106.6200}', now()),

('DRONE-69', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000023',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7420, "lng": 106.6200}', now()),

-- DISTRICT 8 — HUB C (ID: 00000000-0000-0000-0000-000000000024)
('DRONE-70', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000024',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7540, "lng": 106.6832}', now()),

('DRONE-71', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000024',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7540, "lng": 106.6832}', now()),

('DRONE-72', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000024',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7540, "lng": 106.6832}', now()),

-- ============================================
-- DISTRICT 9 — HUB A (ID: 00000000-0000-0000-0000-000000000025)
-- ============================================
('DRONE-73', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000025',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8485, "lng": 106.8165}', now()),

('DRONE-74', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000025',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8485, "lng": 106.8165}', now()),

('DRONE-75', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000025',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8485, "lng": 106.8165}', now()),


-- ============================================
-- DISTRICT 9 — HUB B (ID: 00000000-0000-0000-0000-000000000026)
-- ============================================
('DRONE-76', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000026',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8410, "lng": 106.8280}', now()),

('DRONE-77', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000026',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8410, "lng": 106.8280}', now()),

('DRONE-78', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000026',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8410, "lng": 106.8280}', now()),


-- ============================================
-- DISTRICT 9 — HUB C (ID: 00000000-0000-0000-0000-000000000027)
-- ============================================
('DRONE-79', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000027',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8195, "lng": 106.7765}', now()),

('DRONE-80', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000027',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8195, "lng": 106.7765}', now()),

('DRONE-81', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000027',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8195, "lng": 106.7765}', now()),


-- ============================================
-- DISTRICT 10 — HUB A (ID: 00000000-0000-0000-0000-000000000028)
-- ============================================
('DRONE-82', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000028',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7743, "lng": 106.6689}', now()),

('DRONE-83', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000028',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7743, "lng": 106.6689}', now()),

('DRONE-84', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000028',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7743, "lng": 106.6689}', now()),


-- ============================================
-- DISTRICT 10 — HUB B (ID: 00000000-0000-0000-0000-000000000029)
-- ============================================
('DRONE-85', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000029',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7765, "lng": 106.6613}', now()),

('DRONE-86', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000029',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7765, "lng": 106.6613}', now()),

('DRONE-87', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000029',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7765, "lng": 106.6613}', now()),


-- ============================================
-- DISTRICT 10 — HUB C (ID: 00000000-0000-0000-0000-000000000030)
-- ============================================
('DRONE-88', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000030',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7717, "lng": 106.6666}', now()),

('DRONE-89', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000030',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7717, "lng": 106.6666}', now()),

('DRONE-90', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000030',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7717, "lng": 106.6666}', now()),


-- ============================================
-- DISTRICT 11 — HUB A (ID: 00000000-0000-0000-0000-000000000031)
-- ============================================
('DRONE-91', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000031',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7628, "lng": 106.6567}', now()),

('DRONE-92', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000031',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7628, "lng": 106.6567}', now()),

('DRONE-93', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000031',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7628, "lng": 106.6567}', now()),


-- ============================================
-- DISTRICT 11 — HUB B (ID: 00000000-0000-0000-0000-000000000032)
-- ============================================
('DRONE-94', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000032',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7620, "lng": 106.6490}', now()),

('DRONE-95', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000032',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7620, "lng": 106.6490}', now()),

('DRONE-96', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000032',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7620, "lng": 106.6490}', now()),


-- ============================================
-- DISTRICT 11 — HUB C (ID: 00000000-0000-0000-0000-000000000033)
-- ============================================
('DRONE-97', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000033',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7630, "lng": 106.6420}', now()),

('DRONE-98', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000033',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7630, "lng": 106.6420}', now()),

('DRONE-99', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000033',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7630, "lng": 106.6420}', now()),


-- ============================================
-- DISTRICT 12 — HUB A (ID: 00000000-0000-0000-0000-000000000034)
-- ============================================
('DRONE-100', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000034',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8520, "lng": 106.6500}', now()),

('DRONE-101', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000034',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8520, "lng": 106.6500}', now()),

('DRONE-102', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000034',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8520, "lng": 106.6500}', now()),


-- ============================================
-- DISTRICT 12 — HUB B (ID: 00000000-0000-0000-0000-000000000035)
-- ============================================
('DRONE-103', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000035',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8810, "lng": 106.6580}', now()),

('DRONE-104', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000035',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8810, "lng": 106.6580}', now()),

('DRONE-105', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000035',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8810, "lng": 106.6580}', now()),


-- ============================================
-- DISTRICT 12 — HUB C (ID: 00000000-0000-0000-0000-000000000036)
-- ============================================
('DRONE-106', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000036',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8760, "lng": 106.6530}', now()),

('DRONE-107', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000036',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8760, "lng": 106.6530}', now()),

('DRONE-108', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000036',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8760, "lng": 106.6530}', now()),


-- ============================================
-- BINH THANH — HUB A (ID: 00000000-0000-0000-0000-000000000037)
-- ============================================
('DRONE-109', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000037',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8015, "lng": 106.7135}', now()),

('DRONE-110', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000037',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8015, "lng": 106.7135}', now()),

('DRONE-111', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000037',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8015, "lng": 106.7135}', now()),


-- ============================================
-- BINH THANH — HUB B (ID: 00000000-0000-0000-0000-000000000038)
-- ============================================
('DRONE-112', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000038',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7993, "lng": 106.7062}', now()),

('DRONE-113', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000038',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7993, "lng": 106.7062}', now()),

('DRONE-114', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000038',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7993, "lng": 106.7062}', now()),


-- ============================================
-- BINH THANH — HUB C (ID: 00000000-0000-0000-0000-000000000039)
-- ============================================
('DRONE-115', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000039',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8040, "lng": 106.6860}', now()),

('DRONE-116', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000039',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8040, "lng": 106.6860}', now()),

('DRONE-117', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000039',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8040, "lng": 106.6860}', now()),


-- ============================================
-- PHU NHUAN — HUB A (ID: 00000000-0000-0000-0000-000000000040)
-- ============================================
('DRONE-118', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000040',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7942, "lng": 106.6701}', now()),

('DRONE-119', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000040',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7942, "lng": 106.6701}', now()),

('DRONE-120', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000040',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7942, "lng": 106.6701}', now()),


-- ============================================
-- PHU NHUAN — HUB B (ID: 00000000-0000-0000-0000-000000000041)
-- ============================================
('DRONE-121', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000041',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8001, "lng": 106.6762}', now()),

('DRONE-122', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000041',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8001, "lng": 106.6762}', now()),

('DRONE-123', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000041',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8001, "lng": 106.6762}', now()),


-- ============================================
-- PHU NHUAN — HUB C (ID: 00000000-0000-0000-0000-000000000042)
-- ============================================
('DRONE-124', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000042',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7972, "lng": 106.6750}', now()),

('DRONE-125', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000042',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7972, "lng": 106.6750}', now()),

('DRONE-126', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000042',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7972, "lng": 106.6750}', now()),


-- ============================================
-- TAN BINH — HUB A (ID: 00000000-0000-0000-0000-000000000043)
-- ============================================
('DRONE-127', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000043',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7975, "lng": 106.6660}', now()),

('DRONE-128', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000043',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7975, "lng": 106.6660}', now()),

('DRONE-129', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000043',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7975, "lng": 106.6660}', now()),


-- ============================================
-- TAN BINH — HUB B (ID: 00000000-0000-0000-0000-000000000044)
-- ============================================
('DRONE-130', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000044',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8011, "lng": 106.6678}', now()),

('DRONE-131', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000044',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8011, "lng": 106.6678}', now()),

('DRONE-132', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000044',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8011, "lng": 106.6678}', now()),


-- ============================================
-- TAN BINH — HUB C (ID: 00000000-0000-0000-0000-000000000045)
-- ============================================
('DRONE-133', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000045',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8170, "lng": 106.6430}', now()),

('DRONE-134', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000045',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8170, "lng": 106.6430}', now()),

('DRONE-135', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000045',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8170, "lng": 106.6430}', now()),


-- ============================================
-- BINH TAN — HUB A (ID: 00000000-0000-0000-0000-000000000046)
-- ============================================
('DRONE-136', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000046',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7405, "lng": 106.5901}', now()),

('DRONE-137', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000046',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7405, "lng": 106.5901}', now()),

('DRONE-138', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000046',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7405, "lng": 106.5901}', now()),


-- ============================================
-- BINH TAN — HUB B (ID: 00000000-0000-0000-0000-000000000047)
-- ============================================
('DRONE-139', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000047',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7620, "lng": 106.5965}', now()),

('DRONE-140', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000047',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7620, "lng": 106.5965}', now()),

('DRONE-141', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000047',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7620, "lng": 106.5965}', now()),


-- ============================================
-- BINH TAN — HUB C (ID: 00000000-0000-0000-0000-000000000048)
-- ============================================
('DRONE-142', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000048',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7520, "lng": 106.6030}', now()),

('DRONE-143', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000048',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7520, "lng": 106.6030}', now()),

('DRONE-144', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000048',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7520, "lng": 106.6030}', now()),


-- ============================================
-- TAN PHU — HUB A (ID: 00000000-0000-0000-0000-000000000049)
-- ============================================
('DRONE-145', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000049',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7801, "lng": 106.6221}', now()),

('DRONE-146', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000049',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7801, "lng": 106.6221}', now()),

('DRONE-147', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000049',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7801, "lng": 106.6221}', now()),


-- ============================================
-- TAN PHU — HUB B (ID: 00000000-0000-0000-0000-000000000050)
-- ============================================
('DRONE-148', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000050',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8031, "lng": 106.6227}', now()),

('DRONE-149', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000050',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8031, "lng": 106.6227}', now()),

('DRONE-150', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000050',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8031, "lng": 106.6227}', now()),


-- ============================================
-- TAN PHU — HUB C (ID: 00000000-0000-0000-0000-000000000051)
-- ============================================
('DRONE-151', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000051',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7761, "lng": 106.6291}', now()),

('DRONE-152', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000051',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7761, "lng": 106.6291}', now()),

('DRONE-153', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000051',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7761, "lng": 106.6291}', now()),


-- ============================================
-- BINH CHANH — HUB A (ID: 00000000-0000-0000-0000-000000000052)
-- ============================================
('DRONE-154', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000052',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.6820, "lng": 106.6031}', now()),

('DRONE-155', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000052',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.6820, "lng": 106.6031}', now()),

('DRONE-156', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000052',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.6820, "lng": 106.6031}', now()),


-- ============================================
-- BINH CHANH — HUB B (ID: 00000000-0000-0000-0000-000000000053)
-- ============================================
('DRONE-157', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000053',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.7270, "lng": 106.6820}', now()),

('DRONE-158', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000053',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.7270, "lng": 106.6820}', now()),

('DRONE-159', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000053',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.7270, "lng": 106.6820}', now()),


-- ============================================
-- BINH CHANH — HUB C (ID: 00000000-0000-0000-0000-000000000054)
-- ============================================
('DRONE-160', 'DJI Mavic Air 2', 2.00, 100, 'idle',
 '00000000-0000-0000-0000-000000000054',
 'https://cdn2.cellphones.com.vn/x/media/catalog/product/f/l/flycam-dji-mavic-air-2_2__2.png',
 '{"lat": 10.8355, "lng": 106.5742}', now()),

('DRONE-161', 'DJI Mini Pro 3', 1.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000054',
 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/f/l/flycam-dji-mini-3-pro_1_.png',
 '{"lat": 10.8355, "lng": 106.5742}', now()),

('DRONE-162', 'DJI Matrice 30', 3.50, 100, 'idle',
 '00000000-0000-0000-0000-000000000054',
 'https://cdn.vjshop.vn/flycam/dji/dji-matrice-30-series/dji-matrice-30-series-12-1.jpeg',
 '{"lat": 10.8355, "lng": 106.5742}', now());


