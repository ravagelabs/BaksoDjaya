import express from 'express';
import { getExpenses, addExpense, deleteExpense, EXPENSE_CATEGORIES } from '../controllers/expenseController.js';

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const from = req.query.from ?? date;
        const to = req.query.to ?? date;
        if (!from || !DATE_RE.test(from) || !to || !DATE_RE.test(to)) {
            return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
        }
        const expenses = await getExpenses(from, to);
        res.status(200).json({ message: 'Expenses retrieved successfully', data: expenses, categories: EXPENSE_CATEGORIES });
    } catch (err) {
        console.error('Error in GET /expenses:', err);
        res.status(500).json({ error: 'Failed to retrieve expenses', details: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, amount, date, category, paid_from } = req.body ?? {};
        if (date && !DATE_RE.test(date)) {
            return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
        }
        const expense = await addExpense(name, Number(amount), date, category, paid_from);
        res.status(201).json({ message: 'Expense created successfully', data: expense });
    } catch (err) {
        console.error('Error in POST /expenses:', err);
        res.status(400).json({ error: err.message || 'Failed to create expense' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'Invalid expense id' });
        }
        await deleteExpense(id);
        res.status(200).json({ message: 'Expense deleted successfully' });
    } catch (err) {
        console.error('Error in DELETE /expenses/:id:', err);
        res.status(400).json({ error: err.message || 'Failed to delete expense' });
    }
});

export default router;
