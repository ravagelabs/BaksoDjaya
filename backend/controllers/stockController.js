import db from "../db/db.js";

// ---- Stok barang ----
// qty di stock_item = saldo berjalan; setiap perubahan juga dicatat di stock_move (riwayat).

export const listItems = async () =>
    db.any(
        `SELECT s.id, s.name, s.unit, s.qty::float AS qty, s.min_qty::float AS min_qty,
                COALESCE((SELECT json_agg(json_build_object('product_id', ps.product_id, 'qty', ps.qty::float))
                          FROM product_stock ps WHERE ps.stock_item_id = s.id), '[]') AS usage,
                COALESCE((SELECT SUM(-m.qty) FROM stock_move m
                          WHERE m.stock_item_id = s.id AND m.kind IN ('jual', 'batal')
                            AND (m.created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date), 0)::float AS sold_today
         FROM stock_item s
         WHERE s.archived_at IS NULL
         ORDER BY s.name;`
    );

const cleanName = (n) => String(n ?? "").trim().slice(0, 60);
const num = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error("Jumlah tidak valid.");
    return n;
};

export const createItem = async ({ name, unit, qty, min_qty }, userId) => {
    const n = cleanName(name);
    if (!n) throw new Error("Nama barang wajib diisi.");
    return db.tx(async (t) => {
        const item = await t.one(
            `INSERT INTO stock_item (name, unit, min_qty) VALUES ($1, $2, $3) RETURNING id;`,
            [n, cleanName(unit) || "pcs", Math.max(0, num(min_qty ?? 0))]
        );
        const start = num(qty ?? 0);
        if (start) await move(t, item.id, start, "masuk", "Stok awal", null, userId);
        return item;
    });
};

export const updateItem = async (id, { name, unit, min_qty }) => {
    const res = await db.result(
        `UPDATE stock_item SET name = COALESCE($2, name), unit = COALESCE($3, unit), min_qty = COALESCE($4, min_qty)
         WHERE id = $1 AND archived_at IS NULL;`,
        [id, name != null ? cleanName(name) || null : null, unit != null ? cleanName(unit) || null : null, min_qty != null ? Math.max(0, num(min_qty)) : null]
    );
    if (!res.rowCount) throw new Error("Barang tidak ditemukan.");
};

export const archiveItem = async (id) => {
    await db.none(`UPDATE stock_item SET archived_at = now() WHERE id = $1;`, [id]);
    await db.none(`DELETE FROM product_stock WHERE stock_item_id = $1;`, [id]);
};

// Pemakaian: menu mana saja yang memotong barang ini, dan berapa per porsi
export const setUsage = async (id, usage) => {
    if (!Array.isArray(usage)) throw new Error("Data pemakaian tidak valid.");
    await db.tx(async (t) => {
        await t.none(`DELETE FROM product_stock WHERE stock_item_id = $1;`, [id]);
        for (const u of usage) {
            const q = num(u.qty);
            if (q > 0) await t.none(`INSERT INTO product_stock (product_id, stock_item_id, qty) VALUES ($1, $2, $3);`, [Number(u.product_id), id, q]);
        }
    });
};

async function move(t, itemId, qty, kind, reason, billId, userId) {
    await t.none(
        `INSERT INTO stock_move (stock_item_id, qty, kind, reason, bill_id, user_id) VALUES ($1, $2, $3, $4, $5, $6);`,
        [itemId, qty, kind, reason ?? null, billId ?? null, userId ?? null]
    );
    await t.none(`UPDATE stock_item SET qty = qty + $2 WHERE id = $1;`, [itemId, qty]);
}

// Masuk (+), keluar (rusak/waste, -), atau koreksi ke jumlah hitungan (set)
export const addMove = async (id, { kind, qty, reason }, userId) => {
    const item = await db.oneOrNone(`SELECT id, qty::float AS qty FROM stock_item WHERE id = $1 AND archived_at IS NULL;`, [id]);
    if (!item) throw new Error("Barang tidak ditemukan.");
    const n = num(qty);
    return db.tx(async (t) => {
        if (kind === "masuk") {
            if (n <= 0) throw new Error("Jumlah masuk harus lebih dari 0.");
            await move(t, id, n, "masuk", reason || "Barang masuk", null, userId);
        } else if (kind === "keluar") {
            if (n <= 0) throw new Error("Jumlah keluar harus lebih dari 0.");
            await move(t, id, -n, "keluar", reason || "Dikeluarkan", null, userId);
        } else if (kind === "koreksi") {
            if (n < 0) throw new Error("Jumlah hitungan tidak boleh minus.");
            const diff = n - item.qty;
            if (diff) await move(t, id, diff, "koreksi", reason || "Hitung ulang stok", null, userId);
        } else {
            throw new Error("Jenis gerak stok tidak dikenal.");
        }
    });
};

export const listMoves = async (id, limit = 50) =>
    db.any(
        `SELECT m.id, m.qty::float AS qty, m.kind, m.reason, m.bill_id, m.created_at, u.name AS user_name
         FROM stock_move m LEFT JOIN "user" u ON u.id = m.user_id
         WHERE m.stock_item_id = $1 ORDER BY m.id DESC LIMIT $2;`,
        [id, limit]
    );

// Dipanggil di dalam transaksi bayar: potong stok sesuai pemakaian tiap menu
export const deductForBill = async (t, billId, userId) => {
    const rows = await t.any(
        `SELECT ps.stock_item_id, SUM(bi.qty * ps.qty)::float AS qty
         FROM bill_item bi JOIN product_stock ps ON ps.product_id = bi.product_id
         JOIN stock_item s ON s.id = ps.stock_item_id AND s.archived_at IS NULL
         WHERE bi.bill_id = $1 GROUP BY ps.stock_item_id;`,
        [billId]
    );
    for (const r of rows) await move(t, r.stock_item_id, -r.qty, "jual", null, billId, userId);
};

// Dipanggil saat pesanan dibatalkan: kembalikan stok yang sudah terpotong
export const restoreForBill = async (t, billId, userId) => {
    const rows = await t.any(
        `SELECT stock_item_id, SUM(qty)::float AS qty FROM stock_move
         WHERE bill_id = $1 AND kind IN ('jual', 'batal') GROUP BY stock_item_id HAVING SUM(qty) <> 0;`,
        [billId]
    );
    for (const r of rows) await move(t, r.stock_item_id, -r.qty, "batal", "Pesanan dibatalkan", billId, userId);
};
