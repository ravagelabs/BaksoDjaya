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

// Foto menu yang di-upload dari halaman Pengaturan
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

app.all('/api/auth/*splat', toNodeHandler(auth));

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

// Update realtime untuk layar Dapur, Meja, dan Transaksi
app.use('/events', eventsRouter);

app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, () => {
        console.log(`Listening on PORT 3000`)
});
