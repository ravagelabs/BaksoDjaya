import db from "../db/db.js";

export const getExpenses = async (date) => {
    return await db.any(
        `SELECT id, spent_on::text AS spent_on, name, amount, created_at
         FROM expense
         WHERE spent_on = $1::date
         ORDER BY id;`,
        [date]
    );
};

export const addExpense = async (name, amount, date) => {
    if (!name || !name.trim()) throw new Error('Expense name is required.');
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Amount must be a positive integer.');

    return await db.one(
        `INSERT INTO expense (name, amount, spent_on)
         VALUES ($1, $2, COALESCE($3::date, (now() AT TIME ZONE 'Asia/Jakarta')::date))
         RETURNING id, spent_on::text AS spent_on, name, amount, created_at;`,
        [name.trim(), amount, date || null]
    );
};

export const deleteExpense = async (id) => {
    const res = await db.result('DELETE FROM expense WHERE id = $1', [id]);
    if (!res.rowCount) throw new Error(`Expense #${id} not found.`);
};
