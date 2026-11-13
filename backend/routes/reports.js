import express from 'express';
import { getDailyReport, getSummaryReport } from '../controllers/reportController.js';

const router = express.Router();

router.get('/daily', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
        }
        const report = await getDailyReport(date);
        res.status(200).json({ message: 'Daily report retrieved successfully', data: report });
    } catch (err) {
        console.error('Error in GET /reports/daily:', err);
        res.status(500).json({ error: 'Failed to retrieve report', details: err.message });
    }
});

// Laba rugi untuk rentang tanggal: /reports/summary?from=2026-11-01&to=2026-11-30
router.get('/summary', async (req, res) => {
    try {
        const { from, to } = req.query;
        const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '')) {
            return res.status(400).json({ error: 'Invalid from/to date' });
        }
        if (from > to) return res.status(400).json({ error: 'Tanggal awal tidak boleh setelah tanggal akhir.' });
        const days = (new Date(to) - new Date(from)) / 86400000;
        if (days > 366) return res.status(400).json({ error: 'Rentang laporan maksimal 1 tahun.' });
        res.status(200).json({ message: 'Report retrieved successfully', data: await getSummaryReport(from, to) });
    } catch (err) {
        console.error('Error in GET /reports/summary:', err);
        res.status(500).json({ error: 'Failed to retrieve report', details: err.message });
    }
});

export default router;
