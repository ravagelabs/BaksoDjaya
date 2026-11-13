import db from "../db/db.js";

const COLUMNS = 'id, name, price, picture, category, description, hpp, is_available';

export const getProducts = async () => {
    try {
        const query = `
            SELECT ${COLUMNS}
            FROM product
            WHERE archived_at IS NULL
            ORDER BY id ASC;
        `;
        
        const products = await db.any(query);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
};

const isMoney = (v) => Number.isInteger(v) && v >= 0;
const text = (v) => (typeof v === 'string' ? v.trim() : null);

// Nama disimpan huruf besar supaya konsisten dengan data lama dan format nama paket
const normalizeName = (v) => {
    const name = text(v);
    return name ? name.replace(/\s+/g, ' ').toUpperCase() : null;
};

export const createProduct = async (input) => {
    const name = normalizeName(input.name);
    if (!name) throw new Error('Nama menu wajib diisi.');
    if (!isMoney(input.price) || input.price === 0) throw new Error('Harga harus angka lebih dari 0.');
    if (input.hpp !== undefined && !isMoney(input.hpp)) throw new Error('HPP harus angka 0 atau lebih.');

    return await db.one(
        `INSERT INTO product (name, price, hpp, category, description, picture, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS};`,
        [
            name,
            input.price,
            input.hpp ?? 0,
            text(input.category) || null,
            text(input.description) || null,
            text(input.picture) || '',
            typeof input.is_available === 'boolean' ? input.is_available : true,
        ]
    );
};

// Hanya field yang dikirim yang diubah
export const updateProduct = async (id, input) => {
    if (input.name !== undefined && !normalizeName(input.name)) throw new Error('Nama menu wajib diisi.');
    if (input.price !== undefined && (!isMoney(input.price) || input.price === 0)) throw new Error('Harga harus angka lebih dari 0.');
    if (input.hpp !== undefined && !isMoney(input.hpp)) throw new Error('HPP harus angka 0 atau lebih.');

    const query = `
        UPDATE product
        SET name = COALESCE($2, name),
            price = COALESCE($3, price),
            hpp = COALESCE($4, hpp),
            category = CASE WHEN $5::boolean THEN $6 ELSE category END,
            description = CASE WHEN $7::boolean THEN $8 ELSE description END,
            picture = COALESCE($9, picture),
            is_available = COALESCE($10, is_available)
        WHERE id = $1
        RETURNING ${COLUMNS};
    `;

    const product = await db.oneOrNone(query, [
        id,
        input.name !== undefined ? normalizeName(input.name) : null,
        input.price ?? null,
        input.hpp ?? null,
        input.category !== undefined,
        text(input.category) || null,
        input.description !== undefined,
        text(input.description) || null,
        typeof input.picture === 'string' ? input.picture.trim() : null,
        typeof input.is_available === 'boolean' ? input.is_available : null,
    ]);

    if (!product) throw new Error(`Product #${id} not found.`);
    return product;
};

// Hapus menu dari kasir. Disimpan sebagai arsip supaya transaksi lama tetap bisa dibaca.
export const archiveProduct = async (id) => {
    const row = await db.oneOrNone(
        `UPDATE product SET archived_at = now(), is_available = false
         WHERE id = $1 AND archived_at IS NULL RETURNING id;`,
        [id]
    );
    if (!row) throw new Error(`Product #${id} not found.`);
    return row;
};
