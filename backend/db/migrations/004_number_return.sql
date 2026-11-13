-- Nomor pager: pelanggan bayar dulu, lalu diberi nomor. Nomor tetap "dipakai" sampai pager
-- dikembalikan (bill.number_returned_at terisi), walaupun pesanannya sudah lunas.
-- Backfill hanya sekali saat kolom dibuat: transaksi lama yang sudah lunas dianggap sudah kembali,
-- supaya nomornya tidak tertahan.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bill' AND column_name = 'number_returned_at'
    ) THEN
        ALTER TABLE bill ADD COLUMN number_returned_at timestamptz;
        UPDATE bill
        SET number_returned_at = COALESCE(paid_at, now())
        WHERE table_id IS NOT NULL AND status <> 'pending';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS bill_active_number_idx
    ON bill (table_id) WHERE table_id IS NOT NULL AND number_returned_at IS NULL;
