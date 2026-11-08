import db from "../db/db.js";

export const getModifiers = async () => {
    return await db.any(`
        SELECT id, group_name, kind, name, price, categories
        FROM modifier
        ORDER BY group_name, sort, id;
    `);
};
