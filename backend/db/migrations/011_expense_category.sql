-- Kategori biaya untuk laporan laba rugi (Bahan baku, Gaji, Sewa, dst.)
ALTER TABLE expense ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Lainnya';
CREATE INDEX IF NOT EXISTS expense_spent_on_idx ON expense (spent_on);
