-- Kategori menu jadi teks bebas (sebelumnya enum product_category: main/misc/drinks),
-- supaya outlet bisa memakai nama kategori sendiri, misalnya "Paket", "Bakso", "Minuman".
-- Aman dijalankan berulang: hanya mengubah kolom kalau masih bertipe enum.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'product' AND column_name = 'category' AND udt_name = 'product_category'
    ) THEN
        ALTER TABLE product ALTER COLUMN category DROP DEFAULT;
        ALTER TABLE product ALTER COLUMN category TYPE text USING category::text;
    END IF;
END $$;
