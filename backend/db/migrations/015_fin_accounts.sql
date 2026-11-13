-- Bagan akun disimpan di database supaya kas/bank (mis. Bank BCA, Petty cash) bisa ditambah sendiri
CREATE TABLE IF NOT EXISTS fin_account (
    code text PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense')),
    is_cash boolean NOT NULL DEFAULT false,
    grp text,                -- investing | financing | null (operasional)
    fixed_asset boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO fin_account (code, name, type, is_cash, grp, fixed_asset) VALUES
    ('1-1100', 'Kas (tunai)', 'asset', true, null, false),
    ('1-1200', 'Bank', 'asset', true, null, false),
    ('1-1300', 'Saldo QRIS', 'asset', true, null, false),
    ('1-1400', 'Piutang GoFood', 'asset', false, null, false),
    ('1-1500', 'Piutang GrabFood', 'asset', false, null, false),
    ('1-1600', 'Persediaan bahan', 'asset', false, null, false),
    ('1-2100', 'Peralatan usaha', 'asset', false, 'investing', true),
    ('1-2200', 'Kendaraan', 'asset', false, 'investing', true),
    ('1-2300', 'Bangunan & renovasi', 'asset', false, 'investing', true),
    ('1-2900', 'Aset tetap lainnya', 'asset', false, 'investing', true),
    ('2-1100', 'Utang usaha', 'liability', false, null, false),
    ('2-1200', 'Utang pinjaman', 'liability', false, 'financing', false),
    ('3-1100', 'Modal pemilik', 'equity', false, 'financing', false),
    ('3-1200', 'Prive (penarikan pemilik)', 'equity', false, 'financing', false),
    ('4-1100', 'Pendapatan penjualan', 'revenue', false, null, false),
    ('4-9100', 'Pendapatan lain-lain', 'revenue', false, null, false),
    ('5-1100', 'HPP bahan baku', 'cogs', false, null, false),
    ('5-1200', 'HPP kemasan', 'cogs', false, null, false),
    ('6-1100', 'Beban gaji karyawan', 'expense', false, null, false),
    ('6-1200', 'Beban sewa tempat', 'expense', false, null, false),
    ('6-1300', 'Beban listrik & air', 'expense', false, null, false),
    ('6-1400', 'Beban gas', 'expense', false, null, false),
    ('6-1500', 'Beban transport', 'expense', false, null, false),
    ('6-1600', 'Beban marketing', 'expense', false, null, false),
    ('6-1700', 'Beban perawatan', 'expense', false, null, false),
    ('6-1800', 'Beban komisi aplikasi', 'expense', false, null, false),
    ('6-9100', 'Beban lain-lain', 'expense', false, null, false)
ON CONFLICT (code) DO NOTHING;

-- Jenis jurnal manual (transfer, aset, saldo awal, umum) untuk daftar aset & tampilan
ALTER TABLE journal_entry ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'umum';
