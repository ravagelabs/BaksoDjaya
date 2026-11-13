-- Metode bayar tambahan: Transfer bank, GoFood, GrabFood.
-- 'card' tetap ada supaya transaksi lama tetap terbaca.
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'gofood';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'grabfood';
