-- Akun kas default Bakso Djaya: rekening "Bank" jadi "Bank BCA" (rek. transfer pelanggan) + Petty cash
UPDATE fin_account SET name = 'Bank BCA'
 WHERE code = '1-1200' AND name = 'Bank'
   AND NOT EXISTS (SELECT 1 FROM fin_account WHERE LOWER(name) = 'bank bca');

INSERT INTO fin_account (code, name, type, is_cash)
SELECT '1-1101', 'Petty cash', 'asset', true
 WHERE NOT EXISTS (SELECT 1 FROM fin_account WHERE code = '1-1101' OR LOWER(name) = 'petty cash');
