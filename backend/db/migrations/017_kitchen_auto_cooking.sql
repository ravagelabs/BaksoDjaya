-- Dapur tanpa tahap "Baru": pesanan yang masuk dapur langsung "Dimasak"
UPDATE bill SET kitchen_status = 'cooking' WHERE kitchen_status = 'new';
