-- Shift dicatat per karyawan: owner melihat semua, karyawan melihat shift miliknya sendiri
ALTER TABLE shift ADD COLUMN IF NOT EXISTS employee_id text;
CREATE INDEX IF NOT EXISTS shift_employee_idx ON shift (employee_id, id DESC);
