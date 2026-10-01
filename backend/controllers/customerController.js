import db from "../db/db.js";

export const getCustomers = async () => {
    try {
        const query = `
            SELECT 
                id, 
                name, 
                telp,
                type
            FROM customer
            ORDER BY id ASC;
        `;
        
        const customers = await db.any(query);
        return customers;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
};

export const addCustomer = async (name, telp, type) => {
    if (!name) {
        throw new Error('Customer name is required.');
    }

    const query = `
        INSERT INTO customer (name, telp, type)
        VALUES ($1, $2, $3)
        RETURNING id, name, telp, type;
    `;

    return await db.one(query, [name, telp || null, type || null]);
};