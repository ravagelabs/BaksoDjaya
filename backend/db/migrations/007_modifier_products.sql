-- Pilihan/tambahan juga bisa dipasang ke menu tertentu (bukan hanya per kategori),
-- misalnya "Penyajian: Panas / Es (+1.000)" khusus Teh Tawar dan Teh Manis.
ALTER TABLE modifier ADD COLUMN IF NOT EXISTS product_ids integer[] NOT NULL DEFAULT '{}';
