-- Alter numeric precision for distance/duration to support fractional values
ALTER TABLE deliveries
  ALTER COLUMN distance_meters TYPE DOUBLE PRECISION USING distance_meters::double precision,
  ALTER COLUMN estimated_time_sec TYPE DOUBLE PRECISION USING estimated_time_sec::double precision;

-- Optional: clean obviously invalid routes containing (0,0)
UPDATE deliveries
SET route = NULL,
    updated_at = NOW()
WHERE route::text LIKE '%[0,0]%';
