import db from "../db/db.js";

const SHIFT_COLUMNS = `id, created_at, ended_at`;

export const getShifts = async (limit = 10) => {
    try {
        const query = `
            SELECT
                s.id,
                s.created_at,
                s.ended_at,
                sm.cash,
                sm.card,
                sm.qris,
                sm.total
            FROM shift s
            CROSS JOIN LATERAL (
                SELECT
                    COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'cash'), 0)::float AS cash,
                    COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'card'), 0)::float AS card,
                    COALESCE(SUM(b.grand_total) FILTER (WHERE LOWER(b.payment_method::text) = 'qris'), 0)::float AS qris,
                    COALESCE(SUM(b.grand_total), 0)::float AS total
                FROM bill b
                WHERE b.payment_method IS NOT NULL
                  AND b.created_at >= s.created_at
                  AND b.created_at <= s.ended_at
            ) sm
            ORDER BY s.id DESC
            LIMIT $1;
        `;

        return await db.any(query, [limit]);
    } catch (error) {
        console.error('Error fetching shifts:', error);
        throw error;
    }
};

export const addShift = async (createdAt, endedAt) => {
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

    const query = `
        INSERT INTO shift (created_at, ended_at)
        VALUES ($1, $2)
        RETURNING ${SHIFT_COLUMNS};
    `;

    return await db.one(query, [start.toISOString(), end.toISOString()]);
};