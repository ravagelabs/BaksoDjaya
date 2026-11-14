-- Dapur tanpa tombol: semua pesanan yang masih "Dimasak"/"Siap diambil" dianggap selesai.
-- Omset tidak berubah (status bayar tetap). Nomor pager tetap diurus di halaman Nomor.
UPDATE bill SET kitchen_status = 'served' WHERE kitchen_status IN ('new', 'cooking', 'ready');
