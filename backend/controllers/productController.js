import db from "../db/db.js";

export const getProducts = async () => {
    try {
        const query = `
            SELECT 
                id, 
                name, 
                price, 
                picture, 
                category 
            FROM product
            ORDER BY id ASC;
        `;
        
        const products = await db.any(query);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
};