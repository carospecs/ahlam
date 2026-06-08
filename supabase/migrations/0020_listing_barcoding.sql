-- Barcoding / yard-management fields for the listings table.
-- Allows yards to track physical part location and associate a barcode.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS stock_location TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Index for barcode lookups (scanning).
CREATE INDEX IF NOT EXISTS idx_listings_barcode ON listings (barcode);
CREATE INDEX IF NOT EXISTS idx_listings_stock_location ON listings (stock_location);
