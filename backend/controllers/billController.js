import db, { pgp } from "../db/db.js";


// Created once at module level (reusable, recommended by pg-promise)
const billItemColumns = new pgp.helpers.ColumnSet(
    ['product_id', 'bill_id', 'qty', 'price'],
    { table: 'bill_item' }
);

const buildInsertItemsQuery = (billId, billItems) => {
    const itemsData = billItems.map((item) => ({
        product_id: item.product_id,
        bill_id: billId,
        qty: item.qty,
        price: item.price
    }));

    return pgp.helpers.insert(itemsData, billItemColumns);
};

export const getBills = async (billId = null) => {
    const query = `
        SELECT
            b.id AS "billId",
            b.grand_total::float AS grand_total,
            b.employee_id,
            b.customer_id,
            u.name AS employee_name,
            c.name AS customer_name,
            b.status,
            b.created_at,
            json_agg(
                json_build_object(
                    'id', bi.id,
                    'product_id', bi.product_id,
                    'name', p.name,
                    'qty', bi.qty,
                    'price', bi.price
                )
                ORDER BY bi.id
            ) AS "billItems"
        FROM bill b
        JOIN bill_item bi ON b.id = bi.bill_id
        JOIN "user" u ON b.employee_id = u.id
        LEFT JOIN customer c ON b.customer_id = c.id
        JOIN product p ON bi.product_id = p.id
        WHERE ($1::int IS NULL OR b.id = $1)
        GROUP BY b.id, u.id, c.id
        ORDER BY b.id DESC;
    `;

    return await db.any(query, [billId]);
};

export const addBill = async (customerId, employeeId, grandTotal, billItems) => {
    if (!employeeId || grandTotal === undefined) {
        throw new Error('employeeId and grandTotal are required.');
    }

    if (!billItems || !Array.isArray(billItems) || billItems.length === 0) {
        throw new Error('billItems must be a non-empty array.');
    }

    return await db.tx(async (t) => {
        const insertBillQuery = `
            INSERT INTO bill (customer_id, employee_id, grand_total, status, payment_method)
            VALUES ($1, $2, $3, 'pending', NULL)
            RETURNING id, customer_id, employee_id, grand_total, status, payment_method, created_at;
        `;

        const bill = await t.one(insertBillQuery, [
            customerId || null,
            employeeId,
            grandTotal
        ]);

        const createdItems = await t.any(
            buildInsertItemsQuery(bill.id, billItems) + ' RETURNING *'
        );

        return {
            ...bill,
            items: createdItems
        };
    });
};

export const saveBill = async (billId, customerId, employeeId, grandTotal, billItems) => {
    if (!billId) {
        throw new Error('billId is required.');
    }

    if (!billItems || !Array.isArray(billItems) || billItems.length === 0) {
        throw new Error('billItems must be a non-empty array.');
    }

    return await db.tx(async (t) => {
        // Update bill header only if it is still pending
        const updateBillQuery = `
            UPDATE bill
            SET customer_id = $1,
                employee_id = $2,
                grand_total = $3
            WHERE id = $4 AND status = 'pending'
            RETURNING id, customer_id, employee_id, grand_total, status, payment_method, created_at;
        `;

        const bill = await t.oneOrNone(updateBillQuery, [
            customerId || null,
            employeeId,
            grandTotal,
            billId
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

        return {
            ...bill,
            items: updatedItems
        };
    });
};

export const finalizeBill = async (billId, customerId, employeeId, grandTotal, paymentMethod, billItems) => {
    if (!billId || !paymentMethod) {
        throw new Error('billId and paymentMethod are required to finalize a bill.');
    }

    return await db.tx(async (t) => {
        if (Array.isArray(billItems) && billItems.length > 0) {
            await t.none(`DELETE FROM bill_item WHERE bill_id = $1;`, [billId]);
            await t.none(buildInsertItemsQuery(billId, billItems));
        }

        const finalizeQuery = `
            UPDATE bill
            SET status = 'paid',
                payment_method = $1::payment_method,
                grand_total = $2,
                customer_id = $3,
                employee_id = $4
            WHERE id = $5 AND status = 'pending'
            RETURNING id, customer_id, employee_id, grand_total, status, payment_method, created_at;
        `;

        const finalizedBill = await t.oneOrNone(finalizeQuery, [
            paymentMethod,
            grandTotal,
            customerId || null,
            employeeId,
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