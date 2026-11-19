import crypto from 'node:crypto';
import express from 'express';
import { addExpense } from '../controllers/expenseController.js';
import { getDailyReport } from '../controllers/reportController.js';

// Kunci khusus bot agen (header X-Agent-Key).
// Hanya boleh: POST /expenses dan GET /reports/daily. Selain itu selalu 403.
// Kalau AGENT_API_KEY tidak diisi di .env, fitur ini mati (semua request dengan header itu ditolak).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Bandingkan lewat hash SHA-256 supaya panjang sama dan tahan timing attack
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
function keyOk(provided) {
    const expected = process.env.AGENT_API_KEY;
    if (!expected || expected.length < 32) return false;
    return crypto.timingSafeEqual(sha(provided), sha(expected));
}

const router = express.Router();

// Tanpa header X-Agent-Key: lanjut ke alur login biasa (requireAuth + role)
router.use((req, res, next) => {
    const key = req.get('x-agent-key');
    if (key === undefined) return next('router');
    if (!keyOk(key)) return res.status(401).json({ error: 'Invalid agent key' });
    next();
});

router.post('/expenses', express.json(), async (req, res) => {
    try {
        const { name, amount, date, category, paid_from } = req.body ?? {};
        if (date && !DATE_RE.test(date)) {
            return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
        }
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }
        const expense = await addExpense(name, value, date, category, paid_from);
        console.log(`[agent] expense created id=${expense?.id ?? '?'} amount=${value}`);
        res.status(201).json({ message: 'Expense created successfully', data: expense });
    } catch (err) {
        console.error('Error in agent POST /expenses:', err);
        res.status(400).json({ error: err.message || 'Failed to create expense' });
    }
});

router.get('/reports/daily', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date || !DATE_RE.test(date)) {
            return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
        }
        const report = await getDailyReport(date);
        res.status(200).json({ message: 'Daily report retrieved successfully', data: report });
    } catch (err) {
        console.error('Error in agent GET /reports/daily:', err);
        res.status(500).json({ error: 'Failed to retrieve report' });
    }
});

// Kunci valid tapi endpoint lain (edit, hapus, bills, users, finance, dll): tolak
router.use((req, res) => {
    res.status(403).json({ error: 'Agent key is not allowed for this endpoint' });
});

export default router;
