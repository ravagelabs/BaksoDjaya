import db from "../db/db.js";

// Nomor pager (tabel dining_table). Sebuah nomor "dipakai" selama ada pesanan yang memegangnya
// dan pagernya belum dikembalikan (bill.number_returned_at IS NULL), walaupun sudah lunas.
// Status:
//   available       tidak ada pesanan aktif
//   occupied        pesanan masih diproses dapur (baru / dimasak / siap)
//   waiting_return  pesanan sudah diambil, pager belum dikembalikan
const ACTIVE_BILL = `b.table_id = t.id AND b.number_returned_at IS NULL AND b.status IN ('pending', 'paid')`;

export const getTables = async () => {
    const query = `
        SELECT
            t.id,
            t.code,
            t.seats,
            b.id AS bill_id,
            b.status AS bill_status,
            b.order_type,
            b.grand_total::float AS grand_total,
            b.kitchen_status,
            b.created_at AS bill_created_at,
            b.customer_name,
            COALESCE(b.items, '[]'::json) AS items,
            CASE
                WHEN b.id IS NULL THEN 'available'
                WHEN b.kitchen_status = 'served' THEN 'waiting_return'
                ELSE 'occupied'
            END AS status
        FROM dining_table t
        LEFT JOIN LATERAL (
            SELECT
                b.id, b.status, b.order_type, b.grand_total, b.kitchen_status, b.created_at,
                c.name AS customer_name,
                (
                    SELECT json_agg(
                        json_build_object('name', p.name, 'qty', bi.qty, 'note', bi.note, 'options', bi.options)
                        ORDER BY bi.id
                    )
                    FROM bill_item bi
                    JOIN product p ON p.id = bi.product_id
                    WHERE bi.bill_id = b.id
                ) AS items
            FROM bill b
            LEFT JOIN customer c ON c.id = b.customer_id
            WHERE ${ACTIVE_BILL}
            ORDER BY b.id DESC
            LIMIT 1
        ) b ON true
        ORDER BY t.sort, t.code;
    `;

    return await db.any(query);
};

// Beri nomor ke pesanan (biasanya setelah dibayar). Menolak kalau nomor sedang dipakai pesanan lain.
export const assignNumber = async (billId, tableId) => {
    return await db.tx(async (t) => {
        const table = await t.oneOrNone(`SELECT id, code FROM dining_table WHERE id = $1 FOR UPDATE;`, [tableId]);
        if (!table) throw new Error('Nomor tidak ditemukan.');

        const taken = await t.oneOrNone(
            `SELECT b.id FROM bill b, dining_table t
             WHERE t.id = $1 AND ${ACTIVE_BILL} AND b.id <> $2
             LIMIT 1;`,
            [tableId, billId]
        );
        if (taken) throw new Error(`Nomor ${table.code} sedang dipakai pesanan lain.`);

        const bill = await t.oneOrNone(
            `UPDATE bill SET table_id = $1, number_returned_at = NULL
             WHERE id = $2 AND status IN ('pending', 'paid')
             RETURNING id, status, kitchen_status, table_id;`,
            [tableId, billId]
        );
        if (!bill) throw new Error('Pesanan tidak ditemukan.');
        return { ...bill, table_code: table.code };
    });
};

// Pager dikembalikan pelanggan: nomor bebas dipakai lagi. Riwayat nomor di pesanan tetap tersimpan.
export const returnNumber = async (tableId) => {
    const rows = await db.any(
        `UPDATE bill b SET number_returned_at = now()
         FROM dining_table t
         WHERE t.id = $1 AND ${ACTIVE_BILL}
         RETURNING b.id, b.status, b.kitchen_status;`,
        [tableId]
    );
    return rows;
};
