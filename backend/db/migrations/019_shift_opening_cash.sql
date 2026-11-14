-- Modal awal kasir (uang receh) per shift. Bakso Djaya mulai dengan Rp300.000 di laci.
ALTER TABLE shift ADD COLUMN IF NOT EXISTS opening_cash numeric NOT NULL DEFAULT 300000;
