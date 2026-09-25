import express from 'express';
import { getProducts } from '../db/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const products = await getProducts();
        res.status(201).json(products)
    } catch (err) {
        console.error(err);
        throw err; 
    }
}); 

router.post('/', async (req, res) => {
    try {

    } catch (err) {
        console.error(err);
        throw err; 
    }
});

export default router; 