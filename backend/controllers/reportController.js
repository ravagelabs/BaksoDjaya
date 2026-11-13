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
                COALESCE(SUM(b.grand_total) FILTER (WHERE b.payment_method::text = 'qris'), 0)::float AS qris,
                COALESCE(SUM(b.grand_total) FILTER (WHERE b.payment_method::text = 'transfer'), 0)::float AS transfer,
                COALESCE(SUM(b.grand_total) FILTER (WHERE b.payment_method::text = 'gofood'), 0)::float AS gofood,
                COALESCE(SUM(b.grand_total) FILTER (WHERE b.payment_method::text = 'grabfood'), 0)::float AS grabfood
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

// ---- Laporan laba rugi untuk rentang tanggal (from-to, termasuk keduanya) ----
const IN_RANGE = `(COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date`;

export const getSummaryReport = async (from, to) => {
    return await db.task(async (t) => {
        const sales = await t.one(
            `SELECT COALESCE(SUM(b.grand_total), 0)::float AS net_sales, COUNT(*)::int AS transactions
             FROM bill b WHERE b.status = 'paid' AND ${IN_RANGE};`,
            [from, to]
        );

        // HPP dari HPP menu saat ini; jumlah menu yang HPP-nya masih 0 ikut dihitung untuk peringatan
        const cogs = await t.one(
            `SELECT COALESCE(SUM(bi.qty * p.hpp), 0)::float AS hpp,
                    COUNT(DISTINCT p.id) FILTER (WHERE COALESCE(p.hpp, 0) = 0)::int AS items_without_hpp
             FROM bill b
             JOIN bill_item bi ON bi.bill_id = b.id
             JOIN product p ON p.id = bi.product_id
             WHERE b.status = 'paid' AND ${IN_RANGE};`,
            [from, to]
        );

        // Pembayaran dari mana saja: per metode, jumlah transaksi dan nilainya
        const payments = await t.any(
            `SELECT COALESCE(b.payment_method::text, 'lainnya') AS method,
                    COUNT(*)::int AS count, SUM(b.grand_total)::float AS total
             FROM bill b WHERE b.status = 'paid' AND ${IN_RANGE}
             GROUP BY 1 ORDER BY total DESC;`,
            [from, to]
        );

        const orderTypes = await t.any(
            `SELECT b.order_type::text AS type, COUNT(*)::int AS count, SUM(b.grand_total)::float AS total
             FROM bill b WHERE b.status = 'paid' AND ${IN_RANGE}
             GROUP BY 1 ORDER BY total DESC;`,
            [from, to]
        );

        const expensesByCategory = await t.any(
            `SELECT category, COUNT(*)::int AS count, SUM(amount)::float AS total
             FROM expense WHERE spent_on BETWEEN $1::date AND $2::date
             GROUP BY category ORDER BY total DESC;`,
            [from, to]
        );

        const daily = await t.any(
            `SELECT d::date::text AS date,
                    COALESCE((SELECT SUM(b.grand_total) FROM bill b
                              WHERE b.status = 'paid'
                                AND (COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::date = d::date), 0)::float AS sales,
                    COALESCE((SELECT SUM(e.amount) FROM expense e WHERE e.spent_on = d::date), 0)::float AS expenses
             FROM generate_series($1::date, $2::date, interval '1 day') d
             ORDER BY d;`,
            [from, to]
        );

        const hourly = await t.any(
            `SELECT EXTRACT(HOUR FROM COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::int AS hour,
                    SUM(b.grand_total)::float AS total
             FROM bill b WHERE b.status = 'paid' AND ${IN_RANGE}
             GROUP BY 1 ORDER BY 1;`,
            [from, to]
        );

        const topProducts = await t.any(
            `SELECT p.name, SUM(bi.qty)::int AS qty, SUM(bi.qty * bi.price)::float AS total
             FROM bill b
             JOIN bill_item bi ON bi.bill_id = b.id
             JOIN product p ON p.id = bi.product_id
             WHERE b.status = 'paid' AND ${IN_RANGE}
             GROUP BY p.name ORDER BY qty DESC, p.name LIMIT 8;`,
            [from, to]
        );

        const cancelled = await t.one(
            `SELECT COUNT(*)::int AS count, COALESCE(SUM(b.grand_total), 0)::float AS total
             FROM bill b WHERE b.status = 'cancelled'
               AND (COALESCE(b.cancelled_at, b.created_at) AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date;`,
            [from, to]
        );

        const expensesTotal = expensesByCategory.reduce((sum, e) => sum + e.total, 0);
        const grossProfit = sales.net_sales - cogs.hpp;
        const netProfit = grossProfit - expensesTotal;

        return {
            from,
            to,
            net_sales: sales.net_sales,
            transactions: sales.transactions,
            average_ticket: sales.transactions ? sales.net_sales / sales.transactions : 0,
            hpp: cogs.hpp,
            items_without_hpp: cogs.items_without_hpp,
            gross_profit: grossProfit,
            expenses: expensesTotal,
            expenses_by_category: expensesByCategory,
            net_profit: netProfit,
            net_margin: sales.net_sales ? netProfit / sales.net_sales : 0,
            payments,
            order_types: orderTypes,
            daily,
            hourly,
            top_products: topProducts,
            cancelled,
        };
    });
};
