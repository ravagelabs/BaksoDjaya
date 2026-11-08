import db from "../db/db.js";

// Semua tanggal laporan memakai zona waktu outlet
const TZ = 'Asia/Jakarta';

// Waktu yang dihitung untuk laporan: saat dibayar, atau saat dibuat untuk data lama tanpa paid_at
const PAID_DAY = `(COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::date`;

export const getDailyReport = async (date) => {
    return await db.task(async (t) => {
        const sales = await t.one(
            `SELECT
                COALESCE(SUM(b.grand_total), 0)::float AS net_sales,
                COUNT(*)::int AS transactions
             FROM bill b
             WHERE b.status = 'paid' AND ${PAID_DAY} = $1::date;`,
            [date]
        );

        const cogs = await t.one(
            `SELECT COALESCE(SUM(bi.qty * p.hpp), 0)::float AS hpp
             FROM bill b
             JOIN bill_item bi ON bi.bill_id = b.id
             JOIN product p ON p.id = bi.product_id
             WHERE b.status = 'paid' AND ${PAID_DAY} = $1::date;`,
            [date]
        );

        const hourly = await t.any(
            `SELECT
                EXTRACT(HOUR FROM COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::int AS hour,
                SUM(b.grand_total)::float AS total
             FROM bill b
             WHERE b.status = 'paid' AND ${PAID_DAY} = $1::date
             GROUP BY 1
             ORDER BY 1;`,
            [date]
        );

        const topProducts = await t.any(
            `SELECT p.name, SUM(bi.qty)::int AS qty
             FROM bill b
             JOIN bill_item bi ON bi.bill_id = b.id
             JOIN product p ON p.id = bi.product_id
             WHERE b.status = 'paid' AND ${PAID_DAY} = $1::date
             GROUP BY p.name
             ORDER BY qty DESC, p.name
             LIMIT 5;`,
            [date]
        );

        const expenses = await t.one(
            `SELECT COALESCE(SUM(amount), 0)::float AS total FROM expense WHERE spent_on = $1::date;`,
            [date]
        );

        const payments = await t.one(
            `SELECT
                COALESCE(SUM(b.grand_total) FILTER (WHERE b.payment_method::text = 'cash'), 0)::float AS cash,
                COALESCE(SUM(b.grand_total) FILTER (WHERE b.payment_method::text = 'card'), 0)::float AS card,
                COALESCE(SUM(b.grand_total) FILTER (WHERE b.payment_method::text = 'qris'), 0)::float AS qris
             FROM bill b
             WHERE b.status = 'paid' AND ${PAID_DAY} = $1::date;`,
            [date]
        );

        const grossProfit = sales.net_sales - cogs.hpp;

        return {
            date,
            net_sales: sales.net_sales,
            transactions: sales.transactions,
            hpp: cogs.hpp,
            gross_profit: grossProfit,
            expenses: expenses.total,
            estimated_profit: grossProfit - expenses.total,
            payments,
            hourly,
            top_products: topProducts,
        };
    });
};
