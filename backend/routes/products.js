import express from 'express';
import { getProducts, createProduct, updateProduct } from '../controllers/productController.js';


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

// Tambah menu baru
router.post('/', async (req, res) => {
    try {
        const product = await createProduct(req.body ?? {});
        res.status(201).json({ message: 'Product created successfully', data: product });
    } catch (err) {
        console.error('Error in POST /products:', err);
        res.status(400).json({ error: err.message || 'Failed to create product' });
    }
});

// Ubah data menu: nama, harga, HPP, kategori, deskripsi, foto, atau ketersediaan
router.patch('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'Invalid product id' });
        }
        const product = await updateProduct(id, req.body ?? {});
        res.status(200).json({ message: 'Product updated successfully', data: product });
    } catch (err) {
        console.error('Error in PATCH /products/:id:', err);
        res.status(400).json({ error: err.message || 'Failed to update product' });
    }
});

export default router; 