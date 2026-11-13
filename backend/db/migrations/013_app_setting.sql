-- Pengaturan toko sederhana (key/value), mis. logo outlet untuk aplikasi, struk, dan PDF laporan
CREATE TABLE IF NOT EXISTS app_setting (
    key text PRIMARY KEY,
    value text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
