import express from 'express';
import { addBill, saveBill, finalizeBill, getBills } from '../controllers/billController.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const bills = await getBills();

        return res.status(200).json({
            message: 'Bills retrieved successfully',
            data: bills
        });
    } catch (err) {
        console.error('Error fetching bills:', err);
        return res.status(500).json({
            error: err.message || 'Failed to fetch bills'
        });
    }
});

router.get('/:billId', async (req, res) => {
    try {
        const billId = Number(req.params.billId);
        if (!Number.isInteger(billId)) {
            return res.status(400).json({ error: 'Invalid bill id' });
        }

        const [bill] = await getBills(billId);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        return res.status(200).json({
            message: 'Bill retrieved successfully',
            data: bill // a single object, not an array
        });
    } catch (err) {
        console.error('Error fetching bill:', err);
        return res.status(500).json({
            error: err.message || 'Failed to fetch bill'
        });
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