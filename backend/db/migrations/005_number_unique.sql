-- Pengaman: satu nomor pager hanya boleh dipegang SATU pesanan aktif (belum dikembalikan).
-- Kalau data lama ternyata sudah dobel, index dilewati dulu supaya server tetap jalan
-- (aplikasi tetap menolak nomor yang sedang dipakai).
DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS bill_one_active_bill_per_number
        ON bill (table_id)
        WHERE table_id IS NOT NULL AND number_returned_at IS NULL AND status IN ('pending', 'paid');
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Nomor dobel pada data lama, index unik dilewati';
END $$;
