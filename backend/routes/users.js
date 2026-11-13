import express from 'express';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/userController.js';

// Kelola akun POS. Seluruh route hanya untuk akun utama (dicek di index.js).
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        res.status(200).json({ message: 'Users retrieved', data: await listUsers() });
    } catch (err) {
        console.error('Error in GET /users:', err);
        res.status(500).json({ error: 'Daftar akun belum bisa dimuat.' });
    }
});

router.post('/', async (req, res) => {
    try {
        res.status(201).json({ message: 'User created', data: await createUser(req.body ?? {}) });
    } catch (err) {
        console.error('Error in POST /users:', err);
        res.status(400).json({ error: err.message || 'Akun gagal dibuat.' });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const { role, password, name } = req.body ?? {};
        res.status(200).json({ message: 'User updated', data: await updateUser(req.params.id, { role, password, name }, req.user.id) });
    } catch (err) {
        console.error('Error in PATCH /users/:id:', err);
        res.status(400).json({ error: err.message || 'Akun gagal diubah.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        res.status(200).json({ message: 'User deleted', data: await deleteUser(req.params.id, req.user.id) });
    } catch (err) {
        console.error('Error in DELETE /users/:id:', err);
        res.status(400).json({ error: err.message || 'Akun gagal dihapus.' });
    }
});

export default router;
