import express from 'express';
import { addBill, addBillItems } from '../db/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const {customerId, employeeId, totalPrice, status, items} = req.body;
        const newBill =  await addBill(customerId, employeeId, totalPrice, status);

        const newBillItems = await addBillItems(newBill, items);

        return res.status(201).json({
            message: 'Bill Succesfully Created',
            id: newBill
        });
    } catch (err) {

    }
});

router.post('/', async (req, res) => {
    try {

    } catch (err) {

    }
});

export default router; 