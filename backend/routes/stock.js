import express from 'express';
import { listItems, createItem, updateItem, archiveItem, setUsage, addMove, listMoves } from '../controllers/stockController.js';

// Stok: semua akun bisa melihat, menambah barang, dan mencatat masuk/keluar.
// Ubah pemakaian per menu, hitung ulang, dan hapus barang: akun utama saja.
const router = express.Router();
const ownerOnly = (req, res) => {
    if (req.user?.role === 'owner') return false;
    res.status(403).json({ error: 'Hanya akun utama yang bisa mengubah ini.' });
    return true;
};
const wrap = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(`Error in ${req.method} /stock${req.path}:`, err);
        res.status(400).json({ error: err.message || 'Gagal memproses stok.' });
    }
};
const idOf = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new Error('Barang tidak ditemukan.');
    return id;
};

router.get('/', wrap(async (req, res) => res.json({ data: await listItems() })));
router.post('/', wrap(async (req, res) => res.status(201).json({ data: await createItem(req.body ?? {}, req.user?.id) })));
router.patch('/:id', wrap(async (req, res) => {
    if (ownerOnly(req, res)) return;
    await updateItem(idOf(req), req.body ?? {});
    res.json({ message: 'ok' });
}));
router.delete('/:id', wrap(async (req, res) => {
    if (ownerOnly(req, res)) return;
    await archiveItem(idOf(req));
    res.json({ message: 'ok' });
}));
router.put('/:id/usage', wrap(async (req, res) => {
    if (ownerOnly(req, res)) return;
    await setUsage(idOf(req), req.body?.usage);
    res.json({ message: 'ok' });
}));
router.get('/:id/moves', wrap(async (req, res) => res.json({ data: await listMoves(idOf(req)) })));
router.post('/:id/moves', wrap(async (req, res) => {
    if (req.body?.kind === 'koreksi' && ownerOnly(req, res)) return;
    await addMove(idOf(req), req.body ?? {}, req.user?.id);
    res.status(201).json({ message: 'ok' });
}));

export default router;
