-- QRIS langsung masuk rekening Bank BCA (1-1200), akun "Saldo QRIS" tidak dipakai lagi.
DELETE FROM fin_account
 WHERE code = '1-1300'
   AND NOT EXISTS (SELECT 1 FROM journal_line WHERE account_code = '1-1300')
   AND NOT EXISTS (SELECT 1 FROM expense WHERE paid_from = '1-1300');
