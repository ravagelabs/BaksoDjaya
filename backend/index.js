import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import billsRouter from './routes/bills.js';
import productsRouter from './routes/products.js'
import customersRouter from './routes/customers.js'
import shiftsRouter from './routes/shifts.js'
import modifiersRouter from './routes/modifiers.js'
import tablesRouter from './routes/tables.js'
import expensesRouter from './routes/expenses.js'
import reportsRouter from './routes/reports.js'
import usersRouter from './routes/users.js'
import uploadsRouter, { UPLOAD_DIR } from './routes/uploads.js'
import eventsRouter from './routes/events.js'
import { auth } from './auth.js';
import { toNodeHandler } from 'better-auth/node';
import { requireAuth, requireRole, safeErrors } from './lib/http.js';
import { runMigrations } from './lib/migrate.js';
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DEV_MODE? process.env.DEV_URL : process.env.PROD_URL;

app.use(cors({
    origin: url,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
}))

// Verifikasi aplikasi Android (Ravage POS dari PWABuilder): tanpa ini app menampilkan address bar browser
app.get('/.well-known/assetlinks.json', (req, res) => {
    res.type('application/json').sendFile(path.join(__dirname, 'well-known', 'assetlinks.json'));
});

app.use(express.static(path.join(__dirname, 'dist')));

// Foto menu yang di-upload dari halaman Pengaturan
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

app.all('/api/auth/*splat', toNodeHandler(auth));

// Semua endpoint di bawah ini: pesan error aman + wajib login
app.use(safeErrors);

const API_PATHS = ['/uploads', '/products', '/bills', '/customers', '/shifts', '/modifiers', '/tables', '/expenses', '/reports', '/events', '/users'];
app.use(API_PATHS, requireAuth);

// Khusus pengelola (owner): ubah menu & foto, laporan/HPP, biaya, riwayat shift
const WRITE = ['POST', 'PUT', 'PATCH', 'DELETE'];
app.use('/uploads', requireRole());
app.use(['/products', '/modifiers'], requireRole(undefined, WRITE));
app.use(['/reports', '/expenses', '/users'], requireRole());
app.use('/bills', requireRole(undefined, ['DELETE'])); // hapus pesanan: akun utama saja
app.use('/shifts', requireRole(undefined, ['GET']));

app.use('/uploads', uploadsRouter);

app.use(express.json());

app.use('/products', productsRouter);

app.use('/bills', billsRouter);

app.use('/customers', customersRouter);

app.use('/shifts', shiftsRouter);

app.use('/modifiers', modifiersRouter);

app.use('/tables', tablesRouter);

app.use('/expenses', expensesRouter);

app.use('/reports', reportsRouter);

app.use('/users', usersRouter);

// Update realtime untuk layar Dapur, Meja, dan Transaksi
app.use('/events', eventsRouter);

app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Pastikan struktur database selalu terbaru sebelum menerima request
try {
    await runMigrations();
} catch (err) {
    console.error('Migrasi database gagal. Server tetap jalan, tapi sebagian fitur bisa error:', err);
}

app.listen(3000, () => {
        console.log(`Listening on PORT 3000`)
});
