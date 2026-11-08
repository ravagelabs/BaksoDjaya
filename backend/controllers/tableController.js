import db from "../db/db.js";

// Status meja diturunkan dari bill pending terakhir di meja itu:
// tidak ada bill -> available, kitchen_status 'served' -> waiting_payment, selain itu -> occupied
export const getTables = async () => {
    const query = `
        SELECT
            t.id,
            t.code,
            t.seats,
            b.id AS bill_id,
            b.guests,
            b.grand_total::float AS grand_total,
            b.kitchen_status,
            b.created_at AS bill_created_at,
            CASE
                WHEN b.id IS NULL THEN 'available'
                WHEN b.kitchen_status = 'served' THEN 'waiting_payment'
                ELSE 'occupied'
            END AS status
        FROM dining_table t
        LEFT JOIN LATERAL (
            SELECT id, guests, grand_total, kitchen_status, created_at
            FROM bill
            WHERE table_id = t.id AND status = 'pending'
            ORDER BY id DESC
            LIMIT 1
        ) b ON true
        ORDER BY t.sort, t.code;
    `;

    return await db.any(query);
};
