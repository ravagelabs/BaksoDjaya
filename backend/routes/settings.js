import express from 'express';
import db from '../db/db.js';
import { requireAuth } from '../lib/http.js';

// Pengaturan toko. GET boleh tanpa login (logo tampil di halaman login),
// PUT hanya akun utama.
const ALLOWED = ['outlet_logo'];
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const rows = await db.any('SELECT key, value FROM app_setting WHERE key IN ($1:csv);', [ALLOWED]);
        const data = Object.fromEntries(ALLOWED.map((k) => [k, rows.find((r) => r.key === k)?.value ?? null]));
        res.set('Cache-Control', 'no-store').status(200).json({ message: 'Settings', data });
    } catch (err) {
        console.error('Error in GET /settings:', err);
        res.status(500).json({ error: 'Pengaturan belum bisa dimuat.' });
    }
});

router.put('/', requireAuth, express.json(), async (req, res) => {
    try {
        if (req.user?.role !== 'owner') {
            return res.status(403).json({ error: 'Akun ini tidak punya akses ke fitur tersebut.' });
        }
        const body = req.body ?? {};
        for (const key of ALLOWED) {
            if (!(key in body)) continue;
            const value = body[key] == null || body[key] === '' ? null : String(body[key]).slice(0, 500);
            // Logo hanya boleh file yang di-upload ke server ini
            if (key === 'outlet_logo' && value && !value.startsWith('/uploads/')) {
                return res.status(400).json({ error: 'Logo tidak valid.' });
            }
            await db.none(
                `INSERT INTO app_setting (key, value, updated_at) VALUES ($1, $2, now())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();`,
                [key, value]
            );
        }
        res.status(200).json({ message: 'Settings saved' });
    } catch (err) {
        console.error('Error in PUT /settings:', err);
        res.status(500).json({ error: 'Pengaturan gagal disimpan.' });
    }
});

export default router;
