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

const SHIFT_SELECT = `
    SELECT s.id, s.created_at, s.ended_at, s.employee_id, u.name AS employee_name, sm.*
    FROM shift s
    LEFT JOIN "user" u ON u.id = s.employee_id
    CROSS JOIN LATERAL (${SUMMARY('s.created_at', 's.ended_at')}) sm`;

// employeeId = null: semua shift (akun utama). Selain itu hanya shift milik karyawan tersebut.
export const getShifts = async (employeeId = null, limit = 30) => {
    return await db.any(
        `${SHIFT_SELECT}
         WHERE ($1::text IS NULL OR s.employee_id = $1)
         ORDER BY s.id DESC
         LIMIT $2;`,
        [employeeId, limit]
    );
};

export const getShift = async (id) => db.oneOrNone(`${SHIFT_SELECT} WHERE s.id = $1;`, [id]);

// Shift yang sedang berjalan (sejak login sampai sekarang), belum disimpan
export const getRunningSummary = async (from, to) => db.one(`${SUMMARY('$1::timestamptz', '$2::timestamptz')};`, [from, to]);

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
