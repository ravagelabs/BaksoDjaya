-- Redesign Ravage POS: meja, status dapur, catatan & opsi per item, modifier,
-- ketersediaan menu, HPP, dan biaya operasional.
-- Aman dijalankan berulang kali (idempotent). Jalankan juga di database production.

-- Menu
ALTER TABLE product ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE product ADD COLUMN IF NOT EXISTS hpp integer NOT NULL DEFAULT 0;
ALTER TABLE product ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

-- Meja
CREATE TABLE IF NOT EXISTS dining_table (
    id serial PRIMARY KEY,
    code text NOT NULL UNIQUE,
    seats integer NOT NULL DEFAULT 4,
    sort integer NOT NULL DEFAULT 0
);

INSERT INTO dining_table (code, seats, sort)
SELECT lpad(g::text, 2, '0'), 4, g
FROM generate_series(1, 12) AS g
WHERE NOT EXISTS (SELECT 1 FROM dining_table);

-- Header bill
ALTER TABLE bill ADD COLUMN IF NOT EXISTS table_id integer REFERENCES dining_table (id);
ALTER TABLE bill ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in'; -- dine_in | pickup | delivery
ALTER TABLE bill ADD COLUMN IF NOT EXISTS guests integer;
ALTER TABLE bill ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE bill ADD COLUMN IF NOT EXISTS kitchen_status text; -- NULL | new | cooking | ready | served
ALTER TABLE bill ADD COLUMN IF NOT EXISTS sent_to_kitchen_at timestamptz;
ALTER TABLE bill ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS bill_kitchen_status_idx ON bill (kitchen_status);
CREATE INDEX IF NOT EXISTS bill_table_id_idx ON bill (table_id);

-- Item bill: catatan dapur dan opsi terpilih [{ "group": "Pilihan mie", "name": "Bihun", "price": 0 }]
ALTER TABLE bill_item ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE bill_item ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Pilihan dan tambahan per kategori menu
CREATE TABLE IF NOT EXISTS modifier (
    id serial PRIMARY KEY,
    group_name text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('choice', 'extra')),
    name text NOT NULL,
    price integer NOT NULL DEFAULT 0,
    categories text[] NOT NULL DEFAULT '{}',
    sort integer NOT NULL DEFAULT 0
);

-- Biaya operasional harian
CREATE TABLE IF NOT EXISTS expense (
    id serial PRIMARY KEY,
    spent_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
    name text NOT NULL,
    amount integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
