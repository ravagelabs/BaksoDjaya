import db, { pgp } from "../db/db.js";

const TZ = 'Asia/Jakarta';
const ORDER_TYPES = ['dine_in', 'pickup', 'delivery'];
export const KITCHEN_STATUSES = ['new', 'cooking', 'ready', 'served'];

// Created once at module level (reusable, recommended by pg-promise)
const billItemColumns = new pgp.helpers.ColumnSet(
    [
        'product_id',
        'bill_id',
        'qty',
        'price',
        { name: 'note', def: null },
        { name: 'options', mod: ':json', cast: 'jsonb', def: [] },
    ],
    { table: 'bill_item' }
);

const cleanText = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const normalizeItems = (billItems) =>
    billItems.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
        price: item.price,
        note: cleanText(item.note),
        options: Array.isArray(item.options) ? item.options : [],
    }));

const buildInsertItemsQuery = (billId, billItems) => {
    const itemsData = normalizeItems(billItems).map((item) => ({ ...item, bill_id: billId }));
    return pgp.helpers.insert(itemsData, billItemColumns);
};

// Field header bill yang dikirim dari kasir, dengan nilai aman
const normalizeHeader = ({ customerId, employeeId, grandTotal, tableId, orderType, guests, note }) => ({
    customerId: customerId || null,
    employeeId,
    grandTotal,
    tableId: tableId || null,
    orderType: ORDER_TYPES.includes(orderType) ? orderType : 'dine_in',
    guests: Number.isInteger(guests) && guests > 0 ? guests : null,
    note: cleanText(note),
});

const BILL_SELECT = `
    SELECT
        b.id AS "billId",
        b.grand_total::float AS grand_total,
        b.employee_id,
        b.customer_id,
        u.name AS employee_name,
        c.name AS customer_name,
        c.type AS customer_type,
        b.status,
        b.payment_method,
        b.created_at,
        b.paid_at,
        b.table_id,
        t.code AS table_code,
        b.order_type,
        b.guests,
        b.note,
        b.kitchen_status,
        b.sent_to_kitchen_at,
        json_agg(
            json_build_object(
                'id', bi.id,
                'product_id', bi.product_id,
                'name', p.name,
                'qty', bi.qty,
                'price', bi.price,
                'note', bi.note,
                'options', bi.options
            )
            ORDER BY bi.id
        ) AS "billItems"
    FROM bill b
    JOIN bill_item bi ON b.id = bi.bill_id
    JOIN "user" u ON b.employee_id = u.id
    LEFT JOIN customer c ON b.customer_id = c.id
    LEFT JOIN dining_table t ON b.table_id = t.id
    JOIN product p ON bi.product_id = p.id
`;

export const getBills = async (billId = null, status = null, date = null) => {
    const query = `
        ${BILL_SELECT}
        WHERE ($1::int IS NULL OR b.id = $1)
          AND ($2::text IS NULL OR b.status = $2)
          AND ($3::date IS NULL OR (COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::date = $3::date)
        GROUP BY b.id, u.id, c.id, t.id
        ORDER BY b.id DESC;
    `;

    return await db.any(query, [billId, status, date]);
};

// Antrean dapur: semua bill yang sudah dikirim dan belum disajikan, terlama di atas
export const getKitchenQueue = async () => {
    const query = `
        ${BILL_SELECT}
        WHERE b.kitchen_status IN ('new', 'cooking', 'ready')
        GROUP BY b.id, u.id, c.id, t.id
        ORDER BY b.sent_to_kitchen_at ASC NULLS LAST, b.id ASC;
    `;

    return await db.any(query);
};

export const setKitchenStatus = async (billId, kitchenStatus) => {
    if (!KITCHEN_STATUSES.includes(kitchenStatus)) {
        throw new Error(`kitchenStatus must be one of: ${KITCHEN_STATUSES.join(', ')}`);
    }

    const bill = await db.oneOrNone(
        `UPDATE bill
         SET kitchen_status = $1,
             sent_to_kitchen_at = COALESCE(sent_to_kitchen_at, now()),
             -- "Sudah diambil": pelanggan menukar pager dengan pesanannya, jadi nomor otomatis kembali
             -- (hanya untuk pesanan lunas; yang belum bayar tetap memegang nomornya)
             number_returned_at = CASE
                 WHEN $1 = 'served' AND table_id IS NOT NULL AND status = 'paid'
                     THEN COALESCE(number_returned_at, now())
                 ELSE number_returned_at
             END
         WHERE id = $2
         RETURNING id, kitchen_status, sent_to_kitchen_at;`,
        [kitchenStatus, billId]
    );

    if (!bill) throw new Error(`Bill #${billId} not found.`);
    return bill;
};

// Masuk antrean dapur hanya sekali; bill yang sudah di dapur tidak di-reset statusnya
const SEND_TO_KITCHEN_SQL = `
    UPDATE bill
    SET kitchen_status = 'new', sent_to_kitchen_at = now()
    WHERE id = $1 AND kitchen_status IS NULL;
`;

export const addBill = async (fields, billItems, { sendToKitchen = false } = {}) => {
    const h = normalizeHeader(fields);

    if (!h.employeeId || h.grandTotal === undefined) {
        throw new Error('employeeId and grandTotal are required.');
    }

    if (!billItems || !Array.isArray(billItems) || billItems.length === 0) {
        throw new Error('billItems must be a non-empty array.');
    }

    return await db.tx(async (t) => {
        const insertBillQuery = `
            INSERT INTO bill (customer_id, employee_id, grand_total, status, payment_method,
                              table_id, order_type, guests, note)
            VALUES ($1, $2, $3, 'pending', NULL, $4, $5, $6, $7)
            RETURNING id, customer_id, employee_id, grand_total, status, payment_method, created_at,
                      table_id, order_type, guests, note, kitchen_status;
        `;

        const bill = await t.one(insertBillQuery, [
            h.customerId, h.employeeId, h.grandTotal, h.tableId, h.orderType, h.guests, h.note,
        ]);

        const createdItems = await t.any(
            buildInsertItemsQuery(bill.id, billItems) + ' RETURNING *'
        );

        if (sendToKitchen) await t.none(SEND_TO_KITCHEN_SQL, [bill.id]);

        return {
            ...bill,
            kitchen_status: sendToKitchen ? 'new' : bill.kitchen_status,
            items: createdItems
        };
    });
};

export const saveBill = async (billId, fields, billItems, { sendToKitchen = false } = {}) => {
    if (!billId) {
        throw new Error('billId is required.');
    }

    if (!billItems || !Array.isArray(billItems) || billItems.length === 0) {
        throw new Error('billItems must be a non-empty array.');
    }

    const h = normalizeHeader(fields);

    return await db.tx(async (t) => {
        // Update bill header only if it is still pending
        const updateBillQuery = `
            UPDATE bill
            SET customer_id = $1,
                employee_id = $2,
                grand_total = $3,
                table_id = $4,
                order_type = $5,
                guests = $6,
                note = $7
            WHERE id = $8 AND status = 'pending'
            RETURNING id, customer_id, employee_id, grand_total, status, payment_method, created_at,
                      table_id, order_type, guests, note, kitchen_status;
        `;

        const bill = await t.oneOrNone(updateBillQuery, [
            h.customerId, h.employeeId, h.grandTotal, h.tableId, h.orderType, h.guests, h.note, billId,
        ]);

        if (!bill) {
            throw new Error(`Bill with ID ${billId} was not found or is already finalized.`);
        }

        // Delete existing items for this bill
        await t.none(`DELETE FROM bill_item WHERE bill_id = $1;`, [billId]);

        // Re-insert new set of bill items
        const updatedItems = await t.any(
            buildInsertItemsQuery(billId, billItems) + ' RETURNING *'
        );

        if (sendToKitchen) await t.none(SEND_TO_KITCHEN_SQL, [billId]);

        return {
            ...bill,
            kitchen_status: sendToKitchen && !bill.kitchen_status ? 'new' : bill.kitchen_status,
            items: updatedItems
        };
    });
};

export const finalizeBill = async (billId, fields, paymentMethod, billItems) => {
    if (!billId || !paymentMethod) {
        throw new Error('billId and paymentMethod are required to finalize a bill.');
    }

    const h = normalizeHeader(fields);

    return await db.tx(async (t) => {
        if (Array.isArray(billItems) && billItems.length > 0) {
            await t.none(`DELETE FROM bill_item WHERE bill_id = $1;`, [billId]);
            await t.none(buildInsertItemsQuery(billId, billItems));
        }

        // Pesanan yang langsung dibayar tanpa lewat "Kirim ke dapur" tetap masuk antrean dapur
        const finalizeQuery = `
            UPDATE bill
            SET status = 'paid',
                payment_method = $1::payment_method,
                grand_total = $2,
                customer_id = $3,
                employee_id = $4,
                table_id = $5,
                order_type = $6,
                guests = $7,
                note = $8,
                paid_at = now(),
                kitchen_status = COALESCE(kitchen_status, 'new'),
                sent_to_kitchen_at = COALESCE(sent_to_kitchen_at, now())
            WHERE id = $9 AND status = 'pending'
            RETURNING id, customer_id, employee_id, grand_total, status, payment_method, created_at,
                      paid_at, table_id, order_type, guests, note, kitchen_status;
        `;

        const finalizedBill = await t.oneOrNone(finalizeQuery, [
            paymentMethod,
            h.grandTotal,
            h.customerId,
            h.employeeId,
            h.tableId,
            h.orderType,
            h.guests,
            h.note,
            billId
        ]);

        if (!finalizedBill) {
            throw new Error(`Finalization failed: Bill #${billId} was not found or is already completed/cancelled.`);
        }

        const items = await t.any(
            `SELECT * FROM bill_item WHERE bill_id = $1 ORDER BY id ASC;`,
            [billId]
        );

        return {
            ...finalizedBill,
            items
        };
    });
};

export const getSalesSummary = async (from, to) => {
    const query = `
        SELECT
            COALESCE(SUM(grand_total) FILTER (WHERE LOWER(payment_method::text) = 'cash'), 0)::float AS cash,
            COALESCE(SUM(grand_total) FILTER (WHERE LOWER(payment_method::text) = 'card'), 0)::float AS card,
            COALESCE(SUM(grand_total) FILTER (WHERE LOWER(payment_method::text) = 'qris'), 0)::float AS qris,
            COALESCE(SUM(grand_total) FILTER (WHERE LOWER(payment_method::text) = 'transfer'), 0)::float AS transfer,
            COALESCE(SUM(grand_total) FILTER (WHERE LOWER(payment_method::text) = 'gofood'), 0)::float AS gofood,
            COALESCE(SUM(grand_total) FILTER (WHERE LOWER(payment_method::text) = 'grabfood'), 0)::float AS grabfood,
            COALESCE(SUM(grand_total), 0)::float AS total
        FROM bill
        WHERE payment_method IS NOT NULL
          AND COALESCE(paid_at, created_at) >= $1::timestamptz
          AND COALESCE(paid_at, created_at) <= $2::timestamptz;
    `;

    return await db.one(query, [from, to]);
};
