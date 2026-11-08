import express from 'express';
import { getDailyReport } from '../controllers/reportController.js';

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

export default router;
