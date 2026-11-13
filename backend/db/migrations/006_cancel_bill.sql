-- Pesanan dihapus oleh akun utama = dibatalkan (bukan dihapus permanen), supaya ada jejaknya.
-- Pesanan batal tidak muncul di kasir/dapur/transaksi dan tidak dihitung di laporan.
ALTER TABLE bill ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE bill ADD COLUMN IF NOT EXISTS cancelled_by text;
