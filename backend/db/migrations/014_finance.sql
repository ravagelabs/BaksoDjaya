-- Keuangan: sumber dana biaya + jurnal manual (modal, setor ke bank, pencairan GoFood/QRIS, prive, aset)
ALTER TABLE expense ADD COLUMN IF NOT EXISTS paid_from text NOT NULL DEFAULT '1-1100';

CREATE TABLE IF NOT EXISTS journal_entry (
    id serial PRIMARY KEY,
    entry_date date NOT NULL,
    description text NOT NULL,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_line (
    id serial PRIMARY KEY,
    entry_id integer NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
    account_code text NOT NULL,
    debit bigint NOT NULL DEFAULT 0,
    credit bigint NOT NULL DEFAULT 0,
    CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0))
);
CREATE INDEX IF NOT EXISTS journal_entry_date_idx ON journal_entry (entry_date);
CREATE INDEX IF NOT EXISTS journal_line_entry_idx ON journal_line (entry_id);
