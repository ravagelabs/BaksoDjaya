import express from 'express';
import { subscribe } from '../lib/events.js';

const router = express.Router();

// GET /events: koneksi SSE yang tetap terbuka. Browser (EventSource) otomatis menyambung ulang kalau putus.
router.get('/', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // supaya tidak ditahan reverse proxy (nginx)
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    res.write(`event: ready\ndata: {}\n\n`);

    const unsubscribe = subscribe(({ type, data, at }) => {
        res.write(`event: ${type}\ndata: ${JSON.stringify({ ...data, at })}\n\n`);
    });

    // Komentar kosong berkala supaya koneksi tidak dianggap idle
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
    });
});

export default router;
