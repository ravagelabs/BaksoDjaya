-- Diskon per item (0-100%). 100% = gratis. Harga menu tetap, total baris = harga x qty x (1 - diskon%).
ALTER TABLE bill_item ADD COLUMN IF NOT EXISTS discount_pct integer NOT NULL DEFAULT 0;
DO $$ BEGIN
    ALTER TABLE bill_item ADD CONSTRAINT bill_item_discount_pct_range CHECK (discount_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
