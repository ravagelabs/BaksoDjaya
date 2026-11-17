-- Stok barang (bakso, minuman botol, dll.): jumlah berjalan + riwayat gerak.
-- Stok dipotong otomatis saat transaksi dibayar sesuai "pemakaian" per menu,
-- dikembalikan saat pesanan dibatalkan, dan bisa ditambah/dikeluarkan manual.
CREATE TABLE IF NOT EXISTS stock_item (
    id serial PRIMARY KEY,
    name text NOT NULL,
    unit text NOT NULL DEFAULT 'pcs',
    qty numeric NOT NULL DEFAULT 0,
    min_qty numeric NOT NULL DEFAULT 0,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_stock (
    product_id integer NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    stock_item_id integer NOT NULL REFERENCES stock_item(id) ON DELETE CASCADE,
    qty numeric NOT NULL CHECK (qty > 0),
    PRIMARY KEY (product_id, stock_item_id)
);

CREATE TABLE IF NOT EXISTS stock_move (
    id serial PRIMARY KEY,
    stock_item_id integer NOT NULL REFERENCES stock_item(id) ON DELETE CASCADE,
    qty numeric NOT NULL,
    kind text NOT NULL CHECK (kind IN ('masuk', 'jual', 'keluar', 'batal', 'koreksi')),
    reason text,
    bill_id integer,
    user_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_move_item_idx ON stock_move (stock_item_id, id DESC);
CREATE INDEX IF NOT EXISTS stock_move_bill_idx ON stock_move (bill_id);
