import express from 'express';
import { getTables, assignNumber, returnNumber } from '../controllers/tableController.js';
import { publish } from '../lib/events.js';

const router = express.Router();

const changed = (bill) =>
    publish('bill:changed', { billId: bill.id, kitchenStatus: bill.kitchen_status ?? null, status: bill.status ?? null });

router.get('/', async (req, res) => {
    try {
        const tables = await getTables();
        res.status(200).json({ message: 'Tables retrieved successfully', data: tables });
    } catch (err) {
        console.error('Error in GET /tables:', err);
        res.status(500).json({ error: 'Failed to retrieve tables', details: err.message });
    }
});

// Beri nomor pager ke sebuah pesanan: { billId }
router.post('/:id/assign', async (req, res) => {
    const tableId = Number(req.params.id);
    const billId = Number(req.body?.billId);
    if (!Number.isInteger(tableId) || !Number.isInteger(billId)) {
        return res.status(400).json({ error: 'Data tidak valid.' });
    }
    try {
        const bill = await assignNumber(billId, tableId);
        changed(bill);
        res.status(200).json({ message: 'Number assigned', data: bill });
    } catch (err) {
        console.error('Error in POST /tables/:id/assign:', err);
        res.status(400).json({ error: err.message || 'Nomor gagal diberikan.' });
    }
});

// Pager dikembalikan: nomor bebas dipakai lagi
router.post('/:id/return', async (req, res) => {
    const tableId = Number(req.params.id);
    if (!Number.isInteger(tableId)) return res.status(400).json({ error: 'Data tidak valid.' });
    try {
        const bills = await returnNumber(tableId);
        bills.forEach(changed);
        res.status(200).json({ message: 'Number returned', data: { released: bills.length } });
    } catch (err) {
        console.error('Error in POST /tables/:id/return:', err);
        res.status(500).json({ error: 'Nomor gagal dikembalikan.' });
    }
});

export default router;
