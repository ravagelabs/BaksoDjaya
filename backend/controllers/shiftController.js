import db from "../db/db.js";

// Ringkasan penjualan dalam rentang waktu shift (semua metode bayar + jumlah transaksi)
const SUMMARY = (from, to) => `
    SELECT
        COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'cash'), 0)::float AS cash,
        COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'card'), 0)::float AS card,
        COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'qris'), 0)::float AS qris,
        COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'transfer'), 0)::float AS transfer,
        COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'gofood'), 0)::float AS gofood,
        COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'grabfood'), 0)::float AS grabfood,
        COALESCE(SUM(b.grand_total), 0)::float AS total,
        COUNT(*)::int AS transactions
    FROM bill b
    WHERE b.payment_method IS NOT NULL
      AND b.status = 'paid'
      AND COALESCE(b.paid_at, b.created_at) >= ${from}
      AND COALESCE(b.paid_at, b.created_at) <= ${to}`;

// Menu terjual dalam rentang shift: nama menu + jumlah porsi + nilai (untuk rekap akhir shift)
const ITEMS = (from, to) => `
    SELECT COALESCE(json_agg(x ORDER BY x.name), '[]') AS items FROM (
        SELECT p.name, SUM(bi.qty)::int AS qty,
               SUM(ROUND(bi.qty * bi.price * (100 - bi.discount_pct) / 100.0))::float AS total
        FROM bill b JOIN bill_item bi ON bi.bill_id = b.id JOIN product p ON p.id = bi.product_id
        WHERE b.status = 'paid'
          AND COALESCE(b.paid_at, b.created_at) >= ${from}
          AND COALESCE(b.paid_at, b.created_at) <= ${to}
        GROUP BY p.name
    ) x`;

// Modal awal kasir (uang receh di laci) untuk shift baru
export const OPENING_CASH = 300000;

// Uang keluar dari laci (Kas tunai + Petty cash, akun 1-11xx) pada tanggal shift (zona Asia/Jakarta):
// biaya dibayar dari kas + jurnal yang mengurangi kas (mis. transfer kas -> QRIS untuk kembalian),
// dikurangi jurnal yang menambah kas. Saldo awal (modal pembukaan) tidak dihitung karena sudah jadi modal awal.
const CASH_EXPENSE = (from, to) => `
    SELECT (
        COALESCE((SELECT SUM(e.amount) FROM expense e
                  WHERE e.paid_from LIKE '1-11%'
                    AND e.spent_on BETWEEN (${from} AT TIME ZONE 'Asia/Jakarta')::date AND (${to} AT TIME ZONE 'Asia/Jakarta')::date), 0)
      + COALESCE((SELECT SUM(l.credit - l.debit) FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id
                  WHERE l.account_code LIKE '1-11%' AND j.kind <> 'saldo_awal'
                    AND j.entry_date BETWEEN (${from} AT TIME ZONE 'Asia/Jakarta')::date AND (${to} AT TIME ZONE 'Asia/Jakarta')::date), 0)
    )::float AS cash_expense`;

// Uang di laci seharusnya = modal awal + penjualan tunai - biaya dibayar dari kas
const SHIFT_SELECT = `
    SELECT s.id, s.created_at, s.ended_at, s.employee_id, u.name AS employee_name,
           s.opening_cash::float AS opening_cash, sm.*, ce.cash_expense,
           (s.opening_cash + sm.cash - ce.cash_expense)::float AS cash_in_drawer, it.items
    FROM shift s
    LEFT JOIN "user" u ON u.id = s.employee_id
    CROSS JOIN LATERAL (${SUMMARY('s.created_at', 's.ended_at')}) sm
    CROSS JOIN LATERAL (${CASH_EXPENSE('s.created_at', 's.ended_at')}) ce
    CROSS JOIN LATERAL (${ITEMS('s.created_at', 's.ended_at')}) it`;

// employeeId = null: semua shift (akun utama). Selain itu hanya shift milik karyawan tersebut.
// from/to: tanggal (YYYY-MM-DD, zona Asia/Jakarta) mulai shift; kosong = 30 shift terakhir
export const getShifts = async (employeeId = null, from = null, to = null, limit = 200) => {
    return await db.any(
        `${SHIFT_SELECT}
         WHERE ($1::text IS NULL OR s.employee_id = $1)
           AND ($2::date IS NULL OR (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $2::date AND COALESCE($3::date, $2::date))
         ORDER BY s.id DESC
         LIMIT $4;`,
        [employeeId, from, to, from ? limit : 30]
    );
};

export const getShift = async (id) => db.oneOrNone(`${SHIFT_SELECT} WHERE s.id = $1;`, [id]);

// Shift yang sedang berjalan (sejak login sampai sekarang), belum disimpan
export const getRunningSummary = async (from, to) => {
    const sm = await db.one(`${SUMMARY('$1::timestamptz', '$2::timestamptz')};`, [from, to]);
    const ce = await db.one(`${CASH_EXPENSE('$1::timestamptz', '$2::timestamptz')};`, [from, to]);
    const it = await db.one(`${ITEMS('$1::timestamptz', '$2::timestamptz')};`, [from, to]);
    return { ...sm, ...ce, ...it, opening_cash: OPENING_CASH, cash_in_drawer: OPENING_CASH + sm.cash - ce.cash_expense };
};

export const addShift = async (createdAt, endedAt, employeeId) => {
    const start = new Date(createdAt);
    const end = new Date(endedAt);

    if (!createdAt || Number.isNaN(start.getTime())) {
        throw new Error('created_at is required and must be a valid date.');
    }
    if (!endedAt || Number.isNaN(end.getTime())) {
        throw new Error('ended_at is required and must be a valid date.');
    }
    if (end < start) {
        throw new Error('ended_at cannot be before created_at.');
    }

    const row = await db.one(
        `INSERT INTO shift (created_at, ended_at, employee_id) VALUES ($1, $2, $3) RETURNING id;`,
        [start.toISOString(), end.toISOString(), employeeId ?? null]
    );
    return getShift(row.id);
};

// Hapus catatan shift (akun utama). Transaksi/penjualan tidak ikut terhapus.
export const deleteShift = async (id) => {
    const res = await db.result('DELETE FROM shift WHERE id = $1', [id]);
    if (!res.rowCount) throw new Error('Shift tidak ditemukan.');
};
