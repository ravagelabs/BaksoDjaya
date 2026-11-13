import express from 'express';
import { getModifiers, createModifier } from '../controllers/modifierController.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const modifiers = await getModifiers();
        res.status(200).json({ message: 'Modifiers retrieved successfully', data: modifiers });
    } catch (err) {
        console.error('Error in GET /modifiers:', err);
        res.status(500).json({ error: 'Failed to retrieve modifiers', details: err.message });
    }
});

// Tambah pilihan menu (akun utama saja, dicek di index.js)
router.post('/', async (req, res) => {
    try {
        res.status(201).json({ message: 'Modifier created', data: await createModifier(req.body ?? {}) });
    } catch (err) {
        console.error('Error in POST /modifiers:', err);
        res.status(400).json({ error: err.message || 'Pilihan gagal disimpan.' });
    }
});

export default router;
