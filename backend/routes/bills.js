import express from 'express';
import { addBill, saveBill, finalizeBill } from '../controllers/billController.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        
    } catch (err) {

    }
});

router.post('/', async (req, res) => {
    try {
        const { billId, customerId, employeeId, grandTotal, paymentMethod, billItems } = req.body;

        let result;

        // 1. If paymentMethod is provided, finalize the bill
        if (paymentMethod) {
            const finalBillId = billId || (await addBill(customerId, employeeId, grandTotal, billItems)).id;

            result = await finalizeBill(
                finalBillId,
                customerId,
                employeeId,
                grandTotal,
                paymentMethod,
                billItems
            );
            return res.status(200).json({
                message: 'Bill finalized successfully',
                data: result
            });
        }

        // 2. If billId is provided (without paymentMethod), update/save the pending draft
        if (billId) {
            result = await saveBill(
                billId,
                customerId,
                employeeId,
                grandTotal,
                billItems
            );
            return res.status(200).json({
                message: 'Bill updated successfully',
                data: result
            });
        }

        // 3. Otherwise, create a brand-new pending bill
        result = await addBill(
            customerId,
            employeeId,
            grandTotal,
            billItems
        );

        return res.status(201).json({
            message: 'Bill created successfully',
            data: result
        });

    } catch (err) {
        console.error('Error handling bill processing:', err);
        return res.status(400).json({
            error: err.message || 'Failed to process bill'
        });
    }
});



export default router; 