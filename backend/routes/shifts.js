import express from 'express';
import { getShifts, addShift, getRunningSummary, deleteShift } from '../controllers/shiftController.js';

const router = express.Router();

// Riwayat shift: akun utama melihat semua, karyawan hanya shift miliknya
router.get('/', async (req, res) => {
    try {
        const isOwner = req.user?.role === 'owner';
        const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        const from = DATE_RE.test(req.query.from ?? '') ? req.query.from : null;
        const to = DATE_RE.test(req.query.to ?? '') ? req.query.to : from;
        const shifts = await getShifts(isOwner ? null : req.user.id, from, to);
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

// Hapus riwayat shift: akun utama saja
router.delete('/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'owner') {
            return res.status(403).json({ error: 'Akun ini tidak punya akses ke fitur tersebut.' });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Shift tidak ditemukan.' });
        await deleteShift(id);
        res.status(200).json({ message: 'Shift deleted' });
    } catch (err) {
        console.error('Error in DELETE /shifts/:id:', err);
        res.status(400).json({ error: err.message || 'Shift gagal dihapus.' });
    }
});

export default router;
