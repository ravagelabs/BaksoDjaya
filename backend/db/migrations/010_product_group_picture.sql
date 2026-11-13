-- Foto kartu gabungan di kasir (mis. Mie + Bihun + Kwetiau dalam satu foto).
-- Foto masing-masing jenis tetap di product.picture dan tampil saat jenisnya dipilih.
ALTER TABLE product ADD COLUMN IF NOT EXISTS group_picture text;
