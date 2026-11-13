import db from "../db/db.js";
import { isCashAccount } from "./financeController.js";

// Kategori biaya operasional untuk laporan laba rugi
export const EXPENSE_CATEGORIES = [
    'Bahan baku', 'Gaji karyawan', 'Sewa tempat', 'Listrik & air', 'Gas',
    'Kemasan', 'Transport', 'Marketing', 'Perawatan', 'Lainnya',
];

const COLUMNS = `id, spent_on::text AS spent_on, category, name, amount, paid_from, created_at`;


// Satu tanggal (date) atau rentang (from-to)
export const getExpenses = async (from, to = from) => {
    return await db.any(
        `SELECT ${COLUMNS}
         FROM expense
         WHERE spent_on BETWEEN $1::date AND $2::date
         ORDER BY spent_on DESC, id DESC;`,
        [from, to]
    );
};

export const addExpense = async (name, amount, date, category, paidFrom) => {
    if (!name || !name.trim()) throw new Error('Expense name is required.');
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Amount must be a positive integer.');
    const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'Lainnya';

    return await db.one(
        `INSERT INTO expense (name, amount, spent_on, category, paid_from)
         VALUES ($1, $2, COALESCE($3::date, (now() AT TIME ZONE 'Asia/Jakarta')::date), $4, $5)
         RETURNING ${COLUMNS};`,
        [name.trim(), amount, date || null, cat, (await isCashAccount(paidFrom)) ? paidFrom : '1-1100']
    );
};

export const deleteExpense = async (id) => {
    const res = await db.result('DELETE FROM expense WHERE id = $1', [id]);
    if (!res.rowCount) throw new Error(`Expense #${id} not found.`);
};
