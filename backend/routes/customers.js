import express from 'express';
import { getCustomers, addCustomer } from '../controllers/customerController.js';


const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const customers = await getCustomers();
        res.status(200).json({
            message: 'Customers retrieved successfully',
            data: customers,
        });
    } catch (err) {
        console.error('Error in GET /customers:', err);
        res.status(500).json({
            error: 'Failed to retrieve customers',
            details: err.message,
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, telp, type } = req.body;

        const newCustomer = await addCustomer(name, telp, type);

        return res.status(201).json({
            message: 'Customer created successfully',
            data: newCustomer
        });
    } catch (err) {
        console.error('Error in POST /customers:', err);
        return res.status(400).json({
            error: err.message || 'Failed to create customer'
        });
    }
});

export default router; 