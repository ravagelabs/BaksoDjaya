import express from 'express';
import { getProducts } from '../controllers/productController.js';


const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const products = await getProducts();
        res.status(200).json(products);
    } catch (err) {
        console.error('Error in GET /products:', err);
        res.status(500).json({ 
            error: 'Failed to retrieve products',
            details: err.message 
        });
    }
});

router.post('/', async (req, res) => {
    try {

    } catch (err) {

    }
});

export default router; 