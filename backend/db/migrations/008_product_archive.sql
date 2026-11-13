-- Menu yang dihapus disembunyikan (bukan dihapus permanen) supaya riwayat transaksi tetap utuh
ALTER TABLE product ADD COLUMN IF NOT EXISTS archived_at timestamptz;
