-- Data contoh untuk development. Nama, harga, HPP, dan foto hanya placeholder: ganti dengan menu asli.

INSERT INTO product (name, price, hpp, picture, category, description) VALUES
    ('BAKSO BULAT',  15000,  6000, 'https://placehold.co/600x450/f6efe7/8a7f74?text=Bakso+Bulat',  'Bakso',   'Kuah kaldu sapi, bakso halus, mie, dan sayuran segar.'),
    ('BAKSO URAT',   17000,  7000, 'https://placehold.co/600x450/f6efe7/8a7f74?text=Bakso+Urat',   'Bakso',   'Kuah hangat, bakso urat, mie, dan sayuran segar.'),
    ('BAKSO CAMPUR', 18000,  7500, 'https://placehold.co/600x450/f6efe7/8a7f74?text=Bakso+Campur', 'Bakso',   'Bakso halus dan urat dalam satu mangkuk.'),
    ('MIE AYAM',     15000,  5500, 'https://placehold.co/600x450/f6efe7/8a7f74?text=Mie+Ayam',     'Mie',     'Mie kuning, ayam kecap, sawi, dan bawang goreng.'),
    ('ES TEH',        5000,  1500, 'https://placehold.co/600x450/f6efe7/8a7f74?text=Es+Teh',       'Minuman', 'Teh manis dingin.'),
    ('ES JERUK',      7000,  2500, 'https://placehold.co/600x450/f6efe7/8a7f74?text=Es+Jeruk',     'Minuman', 'Perasan jeruk segar dengan es.');

-- Paket: frontend mencari nama dengan format "PAKET <NAMA> - BAKSO <JENIS> + <MIE>"
INSERT INTO product (name, price, hpp, picture, category, description)
SELECT 'PAKET SIJI - BAKSO ' || b || ' + ' || m, 25000, 10000,
       'https://placehold.co/600x450/f6efe7/8a7f74?text=Paket+Siji', 'Paket',
       'Bakso pilihan, mie atau bihun, dan es teh.'
FROM unnest(ARRAY['BULAT', 'URAT', 'CAMPUR']) AS b
CROSS JOIN unnest(ARRAY['MIE', 'BIHUN']) AS m;

INSERT INTO modifier (group_name, kind, name, price, categories, sort) VALUES
    ('Pilihan mie', 'choice', 'Mie kuning',  0,    '{Bakso}',     1),
    ('Pilihan mie', 'choice', 'Bihun',       0,    '{Bakso}',     2),
    ('Pilihan mie', 'choice', 'Tanpa mie',   0,    '{Bakso}',     3),
    ('Tambahan',    'extra',  'Bakso kecil', 5000, '{Bakso,Mie}', 1),
    ('Tambahan',    'extra',  'Pangsit',     3000, '{Bakso,Mie}', 2),
    ('Es',          'choice', 'Es normal',   0,    '{Minuman}',   1),
    ('Es',          'choice', 'Sedikit es',  0,    '{Minuman}',   2),
    ('Es',          'choice', 'Tanpa es',    0,    '{Minuman}',   3);

INSERT INTO customer (name, telp, type) VALUES
    ('Pelanggan Umum', NULL, 'dine_in');
