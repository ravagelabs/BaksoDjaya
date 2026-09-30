import db from "../db/db.js";

import { db } from '../db'; // Import your initialized pg-promise db instance

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
        
        // db.any returns an array of objects (empty array [] if no records found)
        const products = await db.any(query);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
};