import express from 'express';
import { getShifts, addShift, getRunningSummary } from '../controllers/shiftController.js';

const router = express.Router();

// Riwayat shift: akun utama melihat semua, karyawan hanya shift miliknya
router.get('/', async (req, res) => {
    try {
        const isOwner = req.user?.role === 'owner';
        const shifts = await getShifts(isOwner ? null : req.user.id);
        res.status(200).json({ message: 'Shifts retrieved successfully', data: shifts });
    } catch (err) {
        console.error('Error in GET /shifts:', err);
        res.status(500).json({ error: 'Failed to retrieve shifts', details: err.message });
    }
});

// Shift berjalan: penjualan sejak login (sesi) sampai sekarang
router.get('/current', async (req, res) => {
    try {
        const from = new Date(req.session?.createdAt ?? Date.now());
        const to = new Date();
        const summary = await getRunningSummary(from.toISOString(), to.toISOString());
        res.status(200).json({
            message: 'Current shift',
            data: { created_at: from, ended_at: to, employee_name: req.user?.name ?? null, ...summary },
        });
    } catch (err) {
        console.error('Error in GET /shifts/current:', err);
        res.status(500).json({ error: 'Failed to retrieve shifts', details: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { created_at, ended_at } = req.body;
        const newShift = await addShift(created_at, ended_at, req.user?.id);
        return res.status(201).json({ message: 'Shift created successfully', data: newShift });
    } catch (err) {
        console.error('Error in POST /shifts:', err);
        return res.status(400).json({ error: err.message || 'Failed to create shift' });
    }
});

export default router;
