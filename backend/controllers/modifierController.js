import db from "../db/db.js";

const COLUMNS = 'id, group_name, kind, name, price, categories, product_ids, sort';

export const getModifiers = async () => {
    return await db.any(`
        SELECT ${COLUMNS}
        FROM modifier
        ORDER BY group_name, sort, id;
    `);
};

const textList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
const idList = (v) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []);

// Tambah satu opsi. Grup "choice" = pilih satu (opsi pertama jadi default), "extra" = boleh banyak.
export const createModifier = async (input) => {
    const group = typeof input.group_name === 'string' ? input.group_name.trim() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!group || !name) throw new Error('Nama grup dan nama pilihan wajib diisi.');
    if (!['choice', 'extra'].includes(input.kind)) throw new Error('Jenis pilihan tidak valid.');
    const price = Number(input.price ?? 0);
    if (!Number.isInteger(price) || price < 0) throw new Error('Harga tambahan harus angka 0 atau lebih.');
    const categories = textList(input.categories);
    const productIds = idList(input.product_ids);
    if (!categories.length && !productIds.length) throw new Error('Pilih kategori atau menu untuk pilihan ini.');

    return db.one(
        `INSERT INTO modifier (group_name, kind, name, price, categories, product_ids, sort)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS};`,
        [group, input.kind, name, price, categories, productIds, Number.isInteger(input.sort) ? input.sort : 0]
    );
};
