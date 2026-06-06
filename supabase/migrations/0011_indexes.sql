CREATE INDEX IF NOT EXISTS idx_listings_part_name ON listings (part_name);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings (price);
CREATE INDEX IF NOT EXISTS idx_listings_condition ON listings (condition_grade);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_shop_id ON listings (shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles (make, model);
