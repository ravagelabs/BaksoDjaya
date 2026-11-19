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
import uploadsRouter, { UPLOAD_DIR } from './routes/uploads.js'
import eventsRouter from './routes/events.js'
import { auth } from './auth.js';
import { toNodeHandler } from 'better-auth/node';
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from './lib/requireAuth.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DEV_MODE? process.env.DEV_URL : process.env.PROD_URL;

app.use(cors({
    origin: url,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
}))

app.use(express.static(path.join(__dirname, 'dist')));

// Foto menu yang di-upload dari halaman Pengaturan (file statis tetap publik agar <img> bisa tampil)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

// Rute bawaan Better Auth (login, logout, session, dll). Harus di atas express.json()
app.all('/api/auth/*splat', toNodeHandler(auth));

// Upload foto: hanya user yang sudah login
app.use('/uploads', requireAuth, uploadsRouter);

app.use(express.json());

app.use('/products', requireAuth, productsRouter);

app.use('/bills', requireAuth, billsRouter);

app.use('/customers', requireAuth, customersRouter);

app.use('/shifts', requireAuth, shiftsRouter);

app.use('/modifiers', requireAuth, modifiersRouter);

app.use('/tables', requireAuth, tablesRouter);

app.use('/expenses', requireAuth, expensesRouter);

app.use('/reports', requireAuth, reportsRouter);

// Update realtime untuk layar Dapur, Meja, dan Transaksi
app.use('/events', requireAuth, eventsRouter);

app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, () => {
        console.log(`Listening on PORT 3000`)
});
