import express from 'express';
import { loadAccounts, getFinanceReport, addJournal, deleteJournal, createCashAccount, renameAccount } from '../controllers/financeController.js';

// Keuangan (akun utama saja, dicek di index.js)
const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/accounts', async (req, res) => {
    try {
        res.status(200).json({ message: 'Accounts', data: await loadAccounts() });
    } catch (err) {
        console.error('Error in GET /finance/accounts:', err);
        res.status(500).json({ error: 'Daftar akun belum bisa dimuat.' });
    }
});

// Tambah kas / bank / petty cash
router.post('/accounts', async (req, res) => {
    try {
        res.status(201).json({ message: 'Account created', data: await createCashAccount(req.body ?? {}, req.user?.id) });
    } catch (err) {
        console.error('Error in POST /finance/accounts:', err);
        res.status(400).json({ error: err.message || 'Akun gagal dibuat.' });
    }
});

router.patch('/accounts/:code', async (req, res) => {
    try {
        await renameAccount(req.params.code, req.body?.name);
        res.status(200).json({ message: 'Account updated' });
    } catch (err) {
        console.error('Error in PATCH /finance/accounts/:code:', err);
        res.status(400).json({ error: err.message || 'Akun gagal diubah.' });
    }
});

router.get('/report', async (req, res) => {
    try {
        const { type, from, to } = req.query;
        if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '') || from > to) {
            return res.status(400).json({ error: 'Tanggal tidak valid.' });
        }
        res.status(200).json({ message: 'Report', data: await getFinanceReport(type, from, to) });
    } catch (err) {
        console.error('Error in GET /finance/report:', err);
        res.status(400).json({ error: err.message || 'Laporan belum bisa dimuat.' });
    }
});

router.post('/journal', async (req, res) => {
    try {
        res.status(201).json({ message: 'Journal saved', data: await addJournal(req.body ?? {}, req.user?.id) });
    } catch (err) {
        console.error('Error in POST /finance/journal:', err);
        res.status(400).json({ error: err.message || 'Jurnal gagal disimpan.' });
    }
});

router.delete('/journal/:id', async (req, res) => {
    try {
        await deleteJournal(Number(req.params.id));
        res.status(200).json({ message: 'Journal deleted' });
    } catch (err) {
        console.error('Error in DELETE /finance/journal/:id:', err);
        res.status(400).json({ error: err.message || 'Jurnal gagal dihapus.' });
    }
});

export default router;
