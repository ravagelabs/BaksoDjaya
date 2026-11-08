import express from 'express';
import { addBill, saveBill, finalizeBill, getBills, getSalesSummary, getKitchenQueue, setKitchenStatus } from '../controllers/billController.js';
import { publish } from '../lib/events.js';

// Kabari layar lain (Dapur, Meja, Transaksi). kitchen:new dipakai Dapur untuk bunyi notifikasi.
const announce = (bill, { enteredKitchen = false } = {}) => {
    const data = { billId: bill?.id ?? bill?.billId, kitchenStatus: bill?.kitchen_status ?? null, status: bill?.status ?? null };
    if (enteredKitchen) publish('kitchen:new', data);
    publish('bill:changed', data);
};

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { status, date } = req.query;
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
        }
        const bills = await getBills(null, status || null, date || null);

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

router.get('/summary', async (req, res) => {
    try {
        const from = new Date(req.query.from);
        const to = new Date(req.query.to);
        if (isNaN(from) || isNaN(to)) {
            return res.status(400).json({ error: 'Invalid from/to date' });
        }

        const summary = await getSalesSummary(from.toISOString(), to.toISOString());

        return res.status(200).json({
            message: 'Sales summary retrieved successfully',
            data: summary // { cash, card, qris, total }
        });
    } catch (err) {
        console.error('Error fetching sales summary:', err);
        return res.status(500).json({
            error: err.message || 'Failed to fetch sales summary'
        });
    }
});

// Antrean dapur (Baru, Dimasak, Siap saji)
router.get('/kitchen', async (req, res) => {
    try {
        const bills = await getKitchenQueue();
        return res.status(200).json({
            message: 'Kitchen queue retrieved successfully',
            data: bills
        });
    } catch (err) {
        console.error('Error fetching kitchen queue:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch kitchen queue' });
    }
});

router.patch('/:billId/kitchen', async (req, res) => {
    try {
        const billId = Number(req.params.billId);
        if (!Number.isInteger(billId)) {
            return res.status(400).json({ error: 'Invalid bill id' });
        }
        const result = await setKitchenStatus(billId, req.body?.kitchenStatus);
        announce(result);
        return res.status(200).json({ message: 'Kitchen status updated', data: result });
    } catch (err) {
        console.error('Error updating kitchen status:', err);
        return res.status(400).json({ error: err.message || 'Failed to update kitchen status' });
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
        const { billId, paymentMethod, billItems, sendToKitchen } = req.body;
        // customerId, employeeId, grandTotal, tableId, orderType, guests, note
        const fields = req.body;

        let result;

        // 1. If paymentMethod is provided, finalize the bill
        if (paymentMethod) {
            const finalBillId = billId || (await addBill(fields, billItems)).id;
            // Take away: belum pernah ke dapur, jadi pembayaran = masuk dapur
            const wasInKitchen = billId
                ? Boolean((await getBills(Number(billId)))[0]?.kitchen_status)
                : false;

            result = await finalizeBill(finalBillId, fields, paymentMethod, billItems);
            announce(result, { enteredKitchen: !wasInKitchen });
            return res.status(200).json({
                message: 'Bill finalized successfully',
                data: result
            });
        }

        // 2. If billId is provided (without paymentMethod), update/save the pending draft
        if (billId) {
            const before = (await getBills(Number(billId)))[0];
            result = await saveBill(billId, fields, billItems, { sendToKitchen: Boolean(sendToKitchen) });
            announce(result, { enteredKitchen: Boolean(sendToKitchen) && !before?.kitchen_status });
            return res.status(200).json({
                message: 'Bill updated successfully',
                data: result
            });
        }

        // 3. Otherwise, create a brand-new pending bill
        result = await addBill(fields, billItems, { sendToKitchen: Boolean(sendToKitchen) });
        announce(result, { enteredKitchen: Boolean(sendToKitchen) });

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