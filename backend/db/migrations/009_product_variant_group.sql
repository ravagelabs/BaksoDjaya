-- Menu sejenis (mis. Mie / Bihun / Kwetiau) tampil sebagai satu kartu di kasir, lalu dipilih jenisnya.
-- Tiap jenis tetap produk sendiri supaya harga, stok, dan laporan per item tetap akurat.
ALTER TABLE product ADD COLUMN IF NOT EXISTS variant_group text;
