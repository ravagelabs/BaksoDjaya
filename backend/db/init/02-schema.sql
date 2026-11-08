-- Schema aplikasi POS, direkonstruksi dari query di backend/controllers.
-- Hanya dijalankan otomatis oleh container Postgres saat volume database masih kosong.

-- Kolom tambahan Better Auth (auth.js -> user.additionalFields.role)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

CREATE TYPE payment_method AS ENUM ('cash', 'card', 'qris');

CREATE TABLE customer (
    id serial PRIMARY KEY,
    name text NOT NULL,
    telp text,
    type text -- dine_in | delivery | pickup
);

CREATE TABLE product (
    id serial PRIMARY KEY,
    name text NOT NULL,
    price integer NOT NULL,
    picture text NOT NULL DEFAULT '',
    category text
);

CREATE TABLE bill (
    id serial PRIMARY KEY,
    customer_id integer REFERENCES customer (id),
    employee_id text NOT NULL REFERENCES "user" (id),
    grand_total integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending', -- pending | paid
    payment_method payment_method,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bill_item (
    id serial PRIMARY KEY,
    bill_id integer NOT NULL REFERENCES bill (id) ON DELETE CASCADE,
    product_id integer NOT NULL REFERENCES product (id),
    qty integer NOT NULL,
    price integer NOT NULL
);

CREATE TABLE shift (
    id serial PRIMARY KEY,
    created_at timestamptz NOT NULL,
    ended_at timestamptz NOT NULL
);

CREATE INDEX bill_status_idx ON bill (status);
CREATE INDEX bill_created_at_idx ON bill (created_at);
CREATE INDEX bill_item_bill_id_idx ON bill_item (bill_id);
