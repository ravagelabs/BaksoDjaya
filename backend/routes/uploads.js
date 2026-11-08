import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Upload foto menu sebagai data URL (base64), disimpan di backend/uploads.
// Frontend sudah memperkecil gambar sebelum dikirim, jadi ukurannya kecil.
export const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 2 * 1024 * 1024;

const router = express.Router();

router.post('/', express.json({ limit: '4mb' }), async (req, res) => {
    try {
        const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.data ?? '');
        if (!match) {
            return res.status(400).json({ error: 'Foto harus berupa gambar JPG, PNG, atau WebP.' });
        }
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > MAX_BYTES) {
            return res.status(400).json({ error: 'Ukuran foto maksimal 2 MB.' });
        }

        await mkdir(UPLOAD_DIR, { recursive: true });
        const filename = `${randomUUID()}.${TYPES[match[1]]}`;
        await writeFile(path.join(UPLOAD_DIR, filename), buffer);

        res.status(201).json({ message: 'Upload berhasil', data: { url: `/uploads/${filename}` } });
    } catch (err) {
        console.error('Error in POST /uploads:', err);
        res.status(500).json({ error: 'Gagal menyimpan foto' });
    }
});

export default router;
